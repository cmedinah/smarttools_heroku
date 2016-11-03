"use strict";
const filessystem = require('fs');
let guid = () => 
{
	function s4()
	{
		return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
	}
	return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

let crearDirectorio = (dir) => 
{
	if (!filessystem.existsSync(dir))
	{
		filessystem.mkdirSync(dir);
	}
};

let validateEmail = (email) =>  
{
    var re = /\S+@\S+\.\S+/;
    return re.test(email);
};

let environmentVariables = () => 
{
	return {
				bucket : process.env.AWS_BUCKET,
				accessKeyId : process.env.AWS_ACCESKEYID,
				secretAccessKey : process.env.AWS_SECRETACCESSKEY, 
				ses : 
				{
					accessKeyId : process.env.SES_ACCESKEYID, 
            		secretAccessKey : process.env.SES_SECRETACCESSKEY
				},
			sendgrid :
			{
                                sendGridUser : process.env.SENDGRID_USERNAME,
	                        sendGridKey : process.env.SENDGRID_PASSWORD

			},
				userDB : process.env.USER_MONGODB
			};
};

//process.env.REDISCLOUD_PORT

module.exports.guid = guid;
module.exports.crearDirectorio = crearDirectorio;
module.exports.validateEmail = validateEmail;
module.exports.environmentVariables = environmentVariables;
