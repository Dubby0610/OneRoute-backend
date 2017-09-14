var express = require('express'),
    app = express(),
    port = process.env.PORT || 3000,
    bodyParser = require('body-parser'),

    mongoose = require('mongoose'),
    Token = require('./app/onemap_auth/authModel'); //created model loading here


// mongoose instance connection url connection
mongoose.Promise = global.Promise;
mongoose.connect('mongodb://127.0.0.1/onemapdb', { useMongoClient: true });

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var onemap = require('./app/onemap/omRoutes'); //importing route
onemap(app); //register the route

app.listen(port);

app.use(function(req, res) {
    res.status(404).send({url: req.originalUrl + ' not found'})
});

console.log('One Map RESTful API server started on: ' + port);

