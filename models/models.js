'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

//Colección "cines"
var sesionSchema = new Schema({
    _idPelicula: String,
    peliculaId: String,
    horarios: [String]
});

var cineSchema = new Schema({
    _id: String,
    cineId: String,
    imdbId: String,
    nombre: String,
    _idCiudad: String,
    nombreCiudad: String,
    direccion: String,
    codigoPostal: Number,
    telefono: String,
    precio: String,
    coordLatitud: Number,
    coordLongitud: Number,
    sesiones: [sesionSchema],
    actualizado: Number //cuando actualicé las sesiones de este cine
});

//Colección "provincias"
var ciudadSchema = new Schema({
    _id: String,
    ciudadId: String,
    nombre: String,
    actualizado: Number //cuando actualicé los cines de esta ciudad
});
//TODO el actualizado de ciudad no se usa

var provinciaSchema = new Schema({
    _id: String,
    provinciaId: String,
    nombre: String,
    ciudades: [ciudadSchema],
    actualizado: Number, //cuando actualicé las provincias y ciudades
    sortfield: String
});

//Colección "peliculas"
var peliculaSchema = new Schema({
    _id: String,
    peliculaId: String,
    imdbId: String,
    titulo: String,
    tituloOriginal: String,
    estreno: String,
    anno: Number,
    duracion: Number,
    pais: [String],
    genero: [String],
    estudio: [String],
    sinopsis: {type: String, default: ''},
    director: [String],
    reparto: [String],
    repartoExtendido: [String],
    imagen: {type: String, default: ''}
});

var cineCorrelationSchema = new Schema({
    cineId: String, //Original id de eCartelera
    imdbId: String
});

/*

 module.exports = mongoose.model('Pelicula', movieSchema);
 module.exports = mongoose.model('Cine', provinciaSchema);
 module.exports = mongoose.model('Pelis', peliSchema);*/

module.exports = {
    Pelicula: mongoose.model('Pelicula', peliculaSchema),

    Provincia: mongoose.model('Provincia', provinciaSchema),
    Ciudad: mongoose.model('Ciudad', ciudadSchema),

    Cine: mongoose.model('Cine', cineSchema),
    Sesion: mongoose.model('Sesion', sesionSchema),
    Correlation: mongoose.model('Correlation', cineCorrelationSchema)
};
