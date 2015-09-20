"use strict";

var extractTxibitChapters = function (pagina, callback) {
    //innerElements.push({name: $(this).text(), url: urlEncoded});
    console.log("Pido pagina");
    //console.log(pagina);
    pagina.request(pagina.url, function (err, resp, body) {
        console.log("Paginita");
        if (err) {
            callback(err);
        }

        var $ = pagina.cheerio.load(body),
            innerTorrents = [];

        $('dl').each(function () {
            var header = $(this).find('dt a'),
                titulo = header.text(),
                categoria, idioma, tamano, count = 1;

            //Saco el id del torrent
            var torrentId = header.attr('href');
            torrentId = torrentId.split('/');
            torrentId = torrentId[2];

            $(this).find('li span').each(function () {
                switch (count) {
                    case 1:
                        categoria = $(this).text();
                        break;
                    case 2:
                        idioma = $(this).text();
                        break;
                    case 3:
                        tamano = $(this).text();
                        break;
                }
                count++;
            });

            innerTorrents.push({
                title: titulo,
                id: torrentId,
                category: categoria,
                language: idioma,
                size: tamano
            });
        });

        //Termino
        callback(null, innerTorrents);
    });
};

var parseTorrentsTxibitsoft = function (torrentList, md5) {
    var temporadas = walkTorrentList(torrentList, 1, md5);
    console.log("TEMPS1");
    console.log(temporadas);

    //Si no he sacado datos, intento sacarlos con otro formato: 1992 1x03
    if (temporadas.length === 0) {
        temporadas = walkTorrentList(torrentList, 2, md5);
    }
    console.log("TEMPS2");
    console.log(temporadas);

    return temporadas;
};

var walkTorrentList = function (list, method, md5) {
    var metadata, temporadas = {};

    list.forEach(function (torrent) {
        console.log("*********** Miro " + torrent.title);
        //Saco los metadatos del título
        if (method === 1) {
            console.log("metodo 1");
            metadata = extractTxibitsoftMetadata(torrent.title);
        } else if (method === 2) {
            console.log("metodo 2");
            metadata = extractTxibitsoftMetadata2(torrent.title);
        }

        console.log("*********** META");
        console.log(metadata);
        if (metadata !== null) {
            var mTemporada = metadata.temporada;

            console.log("M1 " + mTemporada);
            if (temporadas[mTemporada] === undefined) {
                console.log("M1B");

                temporadas[mTemporada] = [];
            }
            console.log("*********** Temporadas");
            console.log(temporadas);

            console.log("*********** TORRENT:");
            console.log(torrent);

            //Creo la entrada del torrent con los datos de metadatos y los que venian de la lista de torrents
            temporadas[mTemporada].push({
                id: md5('T' + torrent.id + torrent.title),
                torrentId: torrent.id,
                title: torrent.title,
                titleSmall: metadata.titulo,
                chapter: metadata.capitulo,
                language: metadata.idioma,
                format: metadata.formato,
                source: 'T',
                size: torrent.size
            });
        }
    });

    return temporadas;
};

var extractTxibitsoftMetadata = function (torrentTitle) {
    var temporada = null, capitulo = null, formato = null, idioma = null;

    //La temporada
    var aux = torrentTitle.match(/Temporada [0-9]{1,2}/gi);
    console.log("A");
    console.log(aux);
    if (aux !== undefined && aux !== null && aux !== '') {
        aux = aux[0];
        aux = aux.split(' ');
        aux = parseInt(aux[1]);

        //Compruebo que es un n?mero de verdad
        if (!isNaN(aux)) {
            temporada = aux;
        }
    }

    //El capitulo
    aux = torrentTitle.match(/Cap\.[0-9]{3,4}/gi);
    console.log("B");
    console.log(aux);
    if (aux !== undefined && aux !== null && aux !== '') {
        aux = aux[0];
        aux = aux.replace('Cap.', '');

        //Verifico la temporada, por si antes no la pude sacar
        if (temporada === null) {
            var auxTemp;

            if (aux.length === 3) {
                auxTemp = aux.charAt(aux.length - 3); //de Cap.103 es el 1
            } else if (aux.length === 4) {
                auxTemp = '' + aux.charAt(aux.length - 4) + aux.charAt(aux.length - 3); //de Cap.1103 es el 11
            }

            auxTemp = parseInt(auxTemp);
            if (!isNaN(auxTemp)) {
                temporada = auxTemp;
            }
        }

        //Saco el cap?tulo
        var auxCap = aux.charAt(aux.length - 2) + aux.charAt(aux.length - 1); //de Cap.103 es el 03
        auxCap = parseInt(auxCap);
        if (!isNaN(auxCap)) {
            capitulo = auxCap;
        }
    }

    //El idioma
    aux = torrentTitle.match(/V\.O\.Sub\.([A-Za-zñáéíóúÁÉÍÓÚ ])*/gi);
    console.log("C");
    console.log(aux);
    if (aux !== undefined && aux !== null && aux !== '') {
        aux = aux[0];
        idioma = aux;
    } else {
        aux = torrentTitle.match(/Espa.ol([A-Za-zñáéíóúÁÉÍÓÚ ])*/gi);
        console.log("C2");
        console.log(aux);
        if (aux !== undefined && aux !== null && aux !== '') {
            aux = aux[0];
            idioma = aux;
        }
    }


    //El formato
    aux = torrentTitle.match(/HDTV([A-Za-z0-9 ])*/gi);
    console.log("D");
    console.log(aux);
    if (aux !== undefined && aux !== null && aux !== '') {
        aux = aux[0];
        formato = aux;
    }

    //Corto el título
    var tt = torrentTitle.split('-');
    tt = tt[0].trim();

    console.log({temporada: temporada, capitulo: capitulo, idioma: idioma, titulo: tt, formato: formato});

    if (temporada === null || capitulo === null) {
        return null;
    } else {
        return {
            temporada: temporada,
            capitulo: capitulo,
            titulo: tt,
            idioma: idioma,
            formato: formato
        }
    }
};

//Para series <<Titulo 1x19>>, 12x23
var extractTxibitsoftMetadata2 = function (torrentTitle) {
    var temporada = null, capitulo = null;

    var patt = /^(.*) ([0-9]{1,2})x([0-9]{1,2})$/;
    var res = patt.exec(url);

    var title = res[1].trim();

    //La temporada
    var aux = parseInt(res[2]);

    //Compruebo que es un numero de verdad
    if (!isNaN(aux)) {
        temporada = aux;
    }

    //El capitulo
    aux = parseInt(res[3]);

    //Compruebo que es un numero de verdad
    if (!isNaN(aux)) {
        capitulo = aux;
    }

    if (temporada === null || capitulo === null) {
        return null;
    } else {
        return {
            temporada: temporada,
            capitulo: capitulo,
            titulo: title,
            idioma: null,
            formato: null
        }
    }
};

var generateTxibitSeriePage = function (url) {
//http://www.txibitsoft.com/torrents.php?procesar=1&categorias=%27Series%27&subcategoria=The%20Flash&pagina=2
//http://www.txibitsoft.com/torrents.php?procesar=1&categorias=%27Series%27&subcategoria=The%20Flash

    return url + '&pagina=';
};


module.exports = {
    extractTxibitChapters: extractTxibitChapters,
    parseTorrentsTxibitsoft: parseTorrentsTxibitsoft,
    extractTxibitsoftMetadata: extractTxibitsoftMetadata,
    extractTxibitsoftMetadata2: extractTxibitsoftMetadata2,
    generateTxibitSeriePage: generateTxibitSeriePage,
    walkTorrentList: walkTorrentList
};

