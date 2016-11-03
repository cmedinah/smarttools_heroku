"use strict";
var cron = require('node-cron'), 
	  worker = require('./worker');
    
//Se invoca cada minuto...
cron.schedule('* * * * *', function()
{
    console.log('running a task every minute');
    email_sendgrid.runWorker();
});
