"use strict";
var cron = require('node-cron'), 
	  worker = require('./worker2');
    
//Se invoca cada minuto...
cron.schedule('* * * * *', function()
{
    console.log('running a task every minute');
    worker.runWorker();
});
