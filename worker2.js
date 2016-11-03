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
                                to: 'cameolguin21@gmail.com',
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

    //runWorker();
    module.exports.runWorker = runWorker;
