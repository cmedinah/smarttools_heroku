"use strict";

const db   	            = require('./modules/database'),
      sgTransport = require('nodemailer-sendgrid-transport'),
      nodemailer	    = require('nodemailer'),
//      ses               = require('nodemailer-ses-transport'),
      fs                = require('fs'),
      config 	 	    = JSON.parse(fs.readFileSync('./config.json', 'utf8')), 
      ffmpeg            = require('fluent-ffmpeg'), 
      moment            = require('moment'),    
      s3                = require('s3'),
      aws               = require('aws-sdk'),
      utils			    = require('./modules/utils'),
      environmentVars   = utils.environmentVariables(),
      baseFileTmp       = `${__dirname}/tmpFiles`, 
      client            = s3.createClient
                        ({
                                s3Options: 
                                {
                                    accessKeyId     : environmentVars.accessKeyId,
                                    secretAccessKey : environmentVars.secretAccessKey
                                }
                        }),
  /*   transporter         = nodemailer.createTransport(ses
	  				    ({
                                accessKeyId		: environmentVars.ses.accessKeyId,
                                secretAccessKey	: environmentVars.ses.secretAccessKey
                        }));
*/
options = {
    auth: {
        api_user: environmentVars.sendgrid.sendGridUser,
        api_key: environmentVars.sendgrid.sendGridKey
    }
},
 transporter         = nodemailer.createTransport(sgTransport(options));

    aws.config.update
    ({
        accessKeyId: environmentVars.accessKeyId, 
        secretAccessKey: environmentVars.secretAccessKey, 
        region: config.aws.region
    });
    
    let  sqs    = new aws.SQS(), 
         params = {
                        QueueUrl            : config.aws.sqs.queueUrl,
                        VisibilityTimeout   : 600 
                  };
    let runWorker = () => 
    {
	 let mailOptions = {
                                from: `"SmartTools" <${config.aws.ses.sendEmail}>`,
                                to: 'cameolgui21@gmail.com',
                                subject: `email de prueba se ha sido Convertido ✔`,
                                html: 'estamos probandooooooooooooooooooooooooooooooooooo xD xD xD'
                        };
        //Enviar el e-mail...
        transporter.sendMail(mailOptions, function(error, info)
        {
            if(error)
            {
                return console.log(error);
            }
            console.log('Message sent: ' + info.response);
            callback(error, datosEmail);
        });

    };
    

    //Para el proceso de conversión de vídeos...
    let processConvertVideo = (database, token_video, handle) => 
    {
        db.coleccion("video").aggregate([
        {
            $match : { token_video : token_video} 
        }, 
        {
            $lookup :
            {
                from: "concourse", 
                localField: "token_concurso", 
                foreignField : "token_concurso", 
                as: "concurso"
            }
        }], (err, doc) => 
        {
            let dataVideo = doc[0], 
                concurso  = dataVideo.concurso[0];
            //Inicio...
            if(!err)
            {
                console.log(dataVideo);
                //inicio...
                //Crear el directorio, donde estarán temporalmente los archivos a procesar...
                utils.crearDirectorio(baseFileTmp);
                let localFile = `${__dirname}/tmpFiles/${dataVideo.token_archivo}_org.${dataVideo.extension}`;
                let params = {
                                localFile, 
                                s3Params: 
                                {
                                        Bucket: environmentVars.bucket, 
                                        Key: `${dataVideo.identificacion}/videos/org/${dataVideo.token_archivo}.${dataVideo.extension}` 
                                }
                            };
                var downloader = client.downloadFile(params);
                downloader.on('error', (err) => 
                {
                    console.error("unable to download:", err.stack);
                    database.close();
                });
                downloader.on('progress', () => 
                {
                    console.log("progress", downloader.progressAmount, downloader.progressTotal);
                });
                downloader.on('end', () => 
                {
                    convierteVideo(dataVideo, (err, video) => 
                    {
                        //Para subir el vídeo convertido...
                        uploadFileToS3({type : "convert", extension : "mp4", video}, (err, video) => 
                        {
                            if (!err)
                            {
                                uploadFileToS3({type : "thumbnail", extension : "png", video}, (err, video) => 
                                {
                                    if (!err)
                                    {
                                        //Se borra el archivo temporal que se ha procesado...
                                        fs.unlinkSync(localFile);
                                        //Para enviar el correo electrónico...
                                        enviarEmail(
                                        {
                                            url_concurso : concurso.url_concurso,
                                            token_video : video.token_video, 
                                            nombre_usuario : video.nombre_usuario,
                                            titulo_video : video.titulo_video,
                                            nombre_concurso : concurso.nombre_concurso,
                                            email : video.email
                                        },
                                        (err, send) => 
                                        {
                                            //Inicio actualiza...
                                            actualizaEstadoVideo(
                                            {
                                                video : dataVideo, 
                                                estado : 3, 
                                                errorConvierte : 0
                                            },
                                            (err, video) => 
                                            {
                                                if (err) console.warn("Error guarda", err.message);
                                                //Eliminar la cola...
                                                let params = {
                                                                    QueueUrl: config.aws.sqs.queueUrl, 
                                                                    ReceiptHandle: handle
                                                            };
                                                sqs.deleteMessage(params, (err, data) => 
                                                {
                                                    console.log("DATA ELIMINA COLA");
                                                    console.log(data);
                                                    if(!err)
                                                    {
                                                        console.log("ELIMINA LA COLA");
                                                    }
                                                });
                                                //fin elimina la cola...
                                                database.close();
                                            });
                                            //Fin actualiza...
                                        });
                                        //Fin del correo electrónico...                                        
                                    }
                                    else
                                    {
                                        database.close();
                                    }
                                });
                            }
                            else
                            {
                                database.close();
                            }
                        });
                    });
                });
                //fin...
            }
            else
            {
                database.close();
            }
            //Fin...
        });
    };

    let uploadFileToS3 = (options, callback) => 
    {
        //Saber si el archivo a subir, existe localmente...
        let fileToUpload = `${baseFileTmp}/${options.video.token_archivo}_${options.type}.${options.extension}`;
        console.log(fileToUpload);
        fs.exists(fileToUpload, (exists) => 
        {
            if(exists)
            {
                let params = {
                                localFile : fileToUpload, 
                                s3Params: 
                                {
                                    Bucket  : environmentVars.bucket,
                                    Key     : `${options.video.identificacion}/videos/${options.type}/${options.video.token_archivo}.${options.extension}`, 
                                    ACL     : "public-read-write" 
                                }
                            };
                let uploader = client.uploadFile(params);
                uploader.on('error', (err) => 
                {
                    console.error("unable to upload:", err.stack);
                    callback(true, err.stack);
                });
                uploader.on('progress', () => 
                {
                    console.log("progress", uploader.progressMd5Amount, uploader.progressAmount, uploader.progressTotal);
                });
                uploader.on('end', () => 
                {
                    fs.unlinkSync(fileToUpload);
                    callback(null, options.video);
                });
            }
            else
            {
                callback(true, "File not exists");
            }
        });
    };

    //Para actualizar el estado del vídeo...
    let actualizaEstadoVideo = (opc, callback) => 
    {
        let estados         = ["En cola", "En Proceso", "Procesado"], 
            setActualiza    = {estado_video : opc.estado, nombre_estado_video : estados[opc.estado - 1]};
        //3 indica que lo terminó de procesar...
        if(opc.estado === 3)
        {
            let segundos = 0;
            if(opc.errorConvierte === 0)
            {
                /*
                let parteDuracion = opc.video.duration.split(":");
                for(let i = 0, exp = 2; i < parteDuracion.length; i++, exp--)
                {
                    segundos += Math.round(Math.pow(60, exp) * Number(parteDuracion[i]));
                }
                */
            }
            setActualiza.duracion = segundos;
            setActualiza.duracion_string = "00:00:00";
            //Actualiza el estado de envío del email...
            setActualiza.email_enviado = 1; 
            setActualiza.fecha_envia_email = moment().format(); 
            setActualiza.fecha_envia_email_string = moment().format("DD/MM/YYYY"); 
            setActualiza.fecha_envia_email_timestamp = moment().unix();
            //Para agregar las fechas de conversión...
            let fecha  = {
                            fecha_convierte             : moment().format(),
                            fecha_convierte_string      : moment().format("DD/MM/YYYY"),
                            fecha_convierte_timestamp   : moment().unix()
                        };
            for(let obj in fecha)
            {
                setActualiza[obj] = fecha[obj];
            }
        }
        //Para actualizat el estado del vídeo en la colección...
        db.coleccion("video").update(
        {
            token_video : opc.video.token_video
        }, 
        {
            $set    :  setActualiza
        }, 
        (err, doc) => 
        {
            callback(null, opc.video);
        });
    };

    //Para hacer el envío de email, dle vídeo que se ha convertido...
    let enviarEmail = (datosEmail, callback) => 
    {
        let urls = {
                        video : `${config.sitio.url}/${datosEmail.url_concurso}/${datosEmail.token_video}`, 
                        concurso : `${config.sitio.url}/${datosEmail.url_concurso}`
                };	
        let mensaje = `<!DOCTYPE html>
                        <html lang='en'>
                        <head>
                            <meta charset='UTF-8'>
                            <title>SmartTools</title>
                        </head>
                        <body>
                        <center>
                            <font face='Arial, Helvetica, sans-serif'>
                                <table border='0' cellspacing='0' cellpadding='0' width='600'>
                                <tr>
                                    <td><p align='center'>&nbsp;</p></td>
                                </tr>
                                <tr>
                                    <td>
                                        <p>
                                            <center>
                                                <img border='0' src='https://dl.dropboxusercontent.com/u/181689/smarttools.jpg?a=1'>
                                            </center>
                                        </p>
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        <p>
                                            <center>
                                                <strong><br>
                                                    <font face='Arial, Helvetica, sans-serif'>
                                                        TÚ VÍDEO YA ESTÁ DISPONIBLE
                                                    </font>
                                                </strong>
                                            </center>
                                        </p>
                                        <p align='justify'>
                                            <font face='Arial, Helvetica, sans-serif'>
                                                Hola ${datosEmail.nombre_usuario}, 
                                                el presente correo tiene como fin comunicarte que ha finalizado 
                                                el procesamiento del vídeo 
                                                <b>${datosEmail.titulo_video}</b>
                                                , que has subido en el concurso 
                                                <b><a href = '${urls.concurso}'>${datosEmail.nombre_concurso}</a></b>
                                            </font>.<br><br>
                                        </p>
                                    <center>
                                        <table border = '0' cellspacing='0' cellpadding='0'>
                                                <tr>
                                                    <td align='center' style='-webkit-border-radius: 3px; -moz-border-radius: 3px; border-radius: 3px;' bgcolor='#F44336'><a href='${urls.video}' target='_blank' style='font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; text-decoration: none; -webkit-border-radius: 3px; -moz-border-radius: 3px; border-radius: 3px; padding: 12px 18px; border: 1px solid #F44336; display: inline-block;'>VER TÚ VÍDEO AHORA &rarr;</a></td>
                                                </tr>
                                        </table>
                                        <br>
                                    </center><hr><center>No responder a este correo, ya que ha sido enviado por un proceso automático</center></p>
                                    </td>
                                </tr>
                            </table></font></center></body></html>`;
        let mailOptions = {

                                from: `"SmartTools" <${config.aws.ses.sendEmail}>`,
                                to: datosEmail.email, 
                                subject: `${datosEmail.titulo_video} ha sido Convertido ✔`, 
                                html: mensaje
                        };
        //Enviar el e-mail...
        transporter.sendMail(mailOptions, function(error, info)
        {
            if(error)
            {
                return console.log(error);
            }
            console.log('Message sent: ' + info.response);
            callback(error, datosEmail);
        });
    };

    //Para realizar la conversión de vídeo...
    let convierteVideo = (datosVideo, callback) => 
    {
        let baseUbicaVideo = `${__dirname}/tmpFiles/`, 
            videoOriginal  = `${baseUbicaVideo}/${datosVideo.token_archivo}_org.${datosVideo.extension}`, 
            duration       = 0;
        //.setFfmpegPath("/usr/local/bin/ffmpeg/ffmpeg")
        let command = new ffmpeg({ source: videoOriginal, nolog: true })
	    .setFfmpegPath("vendor/ffmpeg/ffmpeg")        
            .screenshots({
                                        filename: `${datosVideo.token_archivo}_thumbnail.png`,
                                        count: 1,
                                        folder: `${baseUbicaVideo}`
                    });
            command.clone()
                            .save(`${baseUbicaVideo}/${datosVideo.token_archivo}_convert.mp4`)
                            .on('end', () => 
                            {
                                datosVideo.duration = duration;
                                callback(false, datosVideo, duration);
                            })
                            .on('error', (err) => 
                            {
                                callback(true, datosVideo, "00:00:00");
                            })
                            .on('codecData', (data) => 
                            {
                                duration = data.duration;
                            });
    };
    //runWorker();
    module.exports.runWorker = runWorker;
