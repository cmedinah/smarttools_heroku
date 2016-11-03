var nodemailer = require('nodemailer');
var sgTransport = require('nodemailer-sendgrid-transport');
var options = {
    auth: {
        api_user: environmentVars.sendgrid.sendGridUser,
        api_key: environmentVars.sendgrid.sendGridKey
    }
};
var transporter         = nodemailer.createTransport(sgTransport(options));


var email = {
    to: ['c.medinah@uniandes.edu.com'],
    from: 'roger@tacos.com',
    subject: 'Hi there',
    text: 'Awesome sauce',
    html: '<b>Awesome sauce</b>'
};

    let runWorker = () =>
    {
	transporter.sendMail(email, function(err, res) {
	    if (err) {
	        console.log(err)
	    }
	console.log("El correo ha sido enviado.........");


	    console.log(res);
	});

    };

