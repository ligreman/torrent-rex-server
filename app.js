// Dependencias
var express = require('express'),
    app = express(),
    http = require('http'),
    server = http.createServer(app),
    port = process.env.OPENSHIFT_NODEJS_PORT || 80,
    ip = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';

// Configuramos la app para que pueda realizar métodos REST
app.configure(function () {
    app.use(express.bodyParser()); // JSON parsing
    //app.use(express.methodOverride()); // HTTP PUT and DELETE support
    app.use(app.router); // simple route management
});

//Cargo rutas
require('./routes/tx')(app);

// Si no se "queda" en una de las rutas anteriores, devuelvo un 404 siempre
app.use(function (req, res) {
    res.send(404);
});

// El servidor escucha en el puerto 3000
server.listen(port, ip, function () {
    console.log('Node server running on http://localhost');
});