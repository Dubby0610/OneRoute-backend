'use strict';
var mongoose = require('mongoose');
var Schema = mongoose.Schema;


var TokenSchema = new Schema({
    access_token: {
        type: String,
        required: 'Input access token'
    },

    expiry_timestamp : {
        type: String,
        required: 'Input expiry timestamp'
    }
});


module.exports = mongoose.model('Token', TokenSchema);
