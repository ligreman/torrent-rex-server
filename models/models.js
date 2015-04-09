var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var sesionSchema = new Schema({
    peliculaId: {type: String, ref: 'Pelicula'},
    horario: [String]
});

var cineSchema = new Schema({
    _id: String,
    cineId: String,
    ciudadId: String,
    nombre: String,
    direccion: String,
    codigoPostal: Number,
    sesiones: [sesionSchema],
    actualizado: {type: Date, default: Date.now}
});

var ciudadSchema = new Schema({
    _id: String,
    ciudadId: Number,
    nombre: String,
    actualizado: {type: Date, default: Date.now}
});

var provinciaSchema = new Schema({
    _id: String,
    provinciaId: Number,
    nombre: String,
    ciudades: [ciudadSchema]
});

var peliculaSchema = new Schema({
    _id: String,
    peliculaId: Number,
    titulo: String,
    estreno: String,
    anno: Number,
    duracion: Number,
    pais: [String],
    genero: [String],
    sinopsis: {type: String, default: ''},
    director: [String],
    reparto: [String],
    imagen: {type: String, default: ''}
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
    Sesion: mongoose.model('Sesion', sesionSchema)
};
