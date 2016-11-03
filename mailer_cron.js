"use strict";
var cron = require('node-cron'), 
	  email_sendgrid = require('./email_sendgrid');
    
//Se invoca cada minuto...
cron.schedule('* * * * *', function()
{
    console.log('running a task every minute');
    email_sendgrid.runWorker();
});
