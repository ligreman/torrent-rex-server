'use strict';
var DEBUG = true;

var baseUrl = '',
    $OPENSHIFT_REPO_DIR = '/var/lib/openshift/54c7ea625973caf628000150/app-root/runtime/repo/';

if (!DEBUG) {
    baseUrl = $OPENSHIFT_REPO_DIR;
}


var request = require('request'),
    cheerio = require('cheerio'),
    async = require('async'),
    md5 = require('md5'),
    events = require('events'),
    fs = require('fs');
//Q = require('q');


var date = new Date();
var urls = {
    baseUrl: 'http://www.seg-social.es/',
    comunidades: 'http://www.seg-social.es/Internet_1/Masinformacion/CalendarioLaboral/index.htm',
    provincias: 'http://www.seg-social.es/Internet_1/Masinformacion/CalendarioLaboral/index.htm?Comu=',
    localidades: 'http://www.seg-social.es/Internet_1/Masinformacion/CalendarioLaboral/Fiestas/index.htm?Ejercicio=' + date.getFullYear() + '&prov=',
    calendario: '&loc='
};

//Gestor de eventos
var eventEmitter = new events.EventEmitter();

var comunidadesProcesadas = 0, comunidadesTotales = 0;


/*************** LISTENER DE EVENTOS ********************/

//Extraigo las series de newpct
eventEmitter.on('startProcess', function () {
    console.log('Inicio el proceso');

    //Obtengo las comunidades
    request(urls.comunidades, function (err, resp, body) {
        if (err) {
            throw err;
        }

        var $ = cheerio.load(body),
            comunidades = [];

        //Cojo las comunidades
        $('#mapaLstCCAA').find('ul li').each(function () {
            var a = $(this).find('a');
            comunidades.push({
                comunidad: a.text(),
                enlace: urls.baseUrl + a.attr('href')
            });
        });

        //console.log("  ---  Comunidades");
        //console.log(comunidades);

        eventEmitter.emit('stepProvinces', comunidades);
    });
});

eventEmitter.on('stepProvinces', function (comunidades) {
    async.map(comunidades, extractProvinces, function (err, results) {
        if (err) {
            console.log('Error al extraer las provincias:' + err);
        }

        var newComunidades = [];
        results.forEach(function (result) {
            newComunidades.push(result[0]);
        });

        //console.log("  ---  Provincias");
        //console.log(newComunidades);

        eventEmitter.emit('stepLocalidades', newComunidades);
    });
});


function extractProvinces(comunidad, callback) {
    request(comunidad.enlace, function (err, resp, body) {
        if (err) {
            callback(err);
        }

        var $ = cheerio.load(body),
            auxProvincias = [], provincias = [];

        //Cojo las provincias
        $('#mapaLstProvincias').find('ul li').each(function () {
            var a = $(this).find('a');

            auxProvincias.push({
                provincia: a.text(),
                enlace: urls.baseUrl + a.attr('href')
            });
        });

        provincias.push({
            comunidad: comunidad.comunidad,
            provincias: auxProvincias
        });

        callback(null, provincias);
    });
}


eventEmitter.on('stepLocalidades', function (comunidades) {
    //Recorro mi array de comunidades
    var newComunidades = [];

    comunidadesTotales = comunidades.length;

    comunidades.forEach(function (comunidad) {
        async.map(comunidad.provincias, extractLocalidades, function (err, results) {
            if (err) {
                console.log('Error al extraer las localidades:' + err);
            }

            var newProvincias = [];
            results.forEach(function (result) {
                newProvincias.push(result[0]);
            });

            //console.log("  ---  Localidades");
            //console.log(newProvincias);

            newComunidades.push({
                comunidad: comunidad.comunidad,
                id: md5(comunidad.comunidad),
                provincias: newProvincias
            });

            comunidadesProcesadas++;
            eventEmitter.emit('stepSaveJSON', newComunidades);
        });
    });
});

function extractLocalidades(provincia, callback) {
    request(provincia.enlace, function (err, resp, body) {
        if (err) {
            callback(err);
        }

        var $ = cheerio.load(body),
            auxLocalidades = [], localidades = [];

        //Cojo las localidades
        $('#calendarioLstLocalidades').find('ul li').each(function () {
            var a = $(this).find('a');

            auxLocalidades.push({
                id: md5(a.text()),
                localidad: a.text(),
                enlace: urls.baseUrl + a.attr('href')
            });
        });

        localidades.push({
            provincia: provincia.provincia,
            id: md5(provincia.provincia),
            localidades: auxLocalidades
        });

        callback(null, localidades);
    });
}

eventEmitter.on('stepSaveJSON', function (comunidades) {
    //Solo lo ejecuto cuando he terminado
    if (comunidadesProcesadas == comunidadesTotales) {
        fs.writeFileSync(baseUrl + 'jsons/icallocations.json', JSON.stringify(comunidades), 'utf8');

        eventEmitter.emit('generateICals');
    }
});

eventEmitter.emit('startProcess');

/**************************************************************/
/**************************************************************/
/**************************************************************/
/**************************************************************/

eventEmitter.on('generateICals', function () {
    var file = baseUrl + 'jsons/icallocations.json';

    console.log('Inicio generacion de icals');
    if (fs.existsSync(file) === false) {
        console.log("No existe el fichero de enlaces");
    } else {
        var data = fs.readFileSync(file, 'utf8');

        data = JSON.parse(data);

        //Recorro comunidades
        data.forEach(function (comunidad) {
            //Recorro provincias
            comunidad.provincias.forEach(function (provincia) {
                //Recorro localidades
                provincia.localidades.forEach(function (localidad) {
                    request(localidad.enlace, function (err, resp, body) {
                        if (err) {
                            throw err;
                        }

                        var $ = cheerio.load(body), calendario = {}, uid = 0;

                        //Proceso la página
                        var anno = $('h4').text();
                        anno = anno.replace('Calendario laboral ', '');

                        var eventosICal = [];

                        $('#calendarioMeses').find('.calendarioPorTrimestre')
                            .each(function () {
                                //Por trimestre recorro cada tabla del mes buscando fiestas Nacionales
                                $(this).find('td.diaFiestaNacional')
                                    .each(function () {
                                        var mes = $(this).attr('headers');
                                        mes = mes.substr(-2); //cojo los 2 últimos caracteres

                                        var dia = $(this).find('strong').text();
                                        var title = $(this).find('strong').attr('title');
                                        title = title.replace('&nbsp;', ': ');

                                        eventosICal.push({
                                            anno: anno,
                                            mes: mes,
                                            dia: dosDigits(dia),
                                            descripcion: title
                                        });
                                    });

                                //Por trimestre recorro cada tabla del mes buscando fiestas Autonómicas
                                $(this).find('td.diaFiestaAutonomica')
                                    .each(function () {
                                        var mes = $(this).attr('headers');
                                        mes = mes.substr(-2); //cojo los 2 últimos caracteres

                                        var dia = $(this).find('strong').text();
                                        var title = $(this).find('strong').attr('title');
                                        title = title.replace('&nbsp;', ': ');

                                        eventosICal.push({
                                            anno: anno,
                                            mes: mes,
                                            dia: dosDigits(dia),
                                            descripcion: title
                                        });
                                    });

                                //Por trimestre recorro cada tabla del mes buscando fiestas Locales
                                $(this).find('td.diaFiestaLocal')
                                    .each(function () {
                                        var mes = $(this).attr('headers');
                                        mes = mes.substr(-2); //cojo los 2 últimos caracteres

                                        var dia = $(this).find('strong').text();
                                        var title = $(this).find('strong').attr('title');
                                        title = title.replace('&nbsp;', ': ');

                                        eventosICal.push({
                                            anno: anno,
                                            mes: mes,
                                            dia: dosDigits(dia),
                                            descripcion: title
                                        });
                                    });
                            });


                        //Genero el iCal
                        generateICalHeader(localidad.id, localidad.localidad);

                        eventosICal.forEach(function (evento) {
                            generateICalEvent(localidad.id, uid, evento);
                            uid++;
                        });

                        generateICalFooter(localidad.id);
                        //console.log('Escrito ical de: ' + localidad.localidad);
                    });
                });
            });
        });
        console.log('FIN');
    }
});


function generateICalHeader(id, location) {
    var file = baseUrl + 'jsons/icals/' + id + '.ics';

    fs.writeFileSync(file, 'BEGIN:VCALENDAR\nVERSION:2.0\nX-WR-CALNAME:Fiestas ' + location + '\nCALSCALE:GERGORIAN', 'utf8');
}

function generateICalEvent(id, uid, evento) {
    var file = baseUrl + 'jsons/icals/' + id + '.ics';

    fs.appendFileSync(file, '\nBEGIN:VEVENT\nUID:' + uid +
        '\nDTSTART;VALUE=DATE:' + evento.anno + evento.mes + evento.dia +
        '\nSUMMARY:' + evento.descripcion +
        '\nEND:VEVENT', 'utf8');
}

function generateICalFooter(id) {
    var file = baseUrl + 'jsons/icals/' + id + '.ics';

    fs.appendFileSync(file, '\nEND:VCALENDAR', 'utf8');
}

function dosDigits(n) {
    if (n.length < 2) {
        return '0' + n;
    } else {
        return n;
    }
}
