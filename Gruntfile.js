module.exports = function (grunt) {
    'use strict';
    var srcFiles = [
            'Gruntfile.js', 'app.js', 'lib/*.js', 'spec/*.js'
        ],
        pkg = grunt.file.readJSON('package.json');

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        jshint: {
            files: srcFiles,
            options: pkg.jshintConfig
        },
        jscs: {
            src: srcFiles,
            options: pkg.jscsConfig
        },
        clean: {
            coverage: {
                src: ['coverage/']
            }
        },
        copy: {
            coverage: {
                src: ['spec/**'],
                dest: 'coverage/'
            }
        },
        instrument: {
            files: 'lib/*.js',
            options: {
                lazy: true,
                basePath: 'coverage/'
            }
        },
        mochaTest: {
            all: {
                options: {
                    reporter: 'spec',
                    require: './spec/testHelper.js'
                },
                src: ['coverage/spec/*Spec.js']
            }
        },
        storeCoverage: {
            options: {
                dir: 'coverage/reports'
            }
        },
        coverage: {
            options: {
                thresholds: {
                    'statements': 100,
                    'branches': 100,
                    'lines': 100,
                    'functions': 100
                },
                dir: 'coverage/reports',
                root: '.'
            }
        },
        makeReport: {
            src: 'coverage/reports/**/*.json',
            options: {
                type: 'lcov',
                dir: 'coverage/reports',
                print: 'detail'
            }
        },
        shell: {
            target: {
                command: [
                    'git update-index --chmod=+x .openshift/action_hooks/post_deploy',
                    'git push'
                ].join('&&')
            }
        },
        replace: {
            pro: {
                src: ['routes/*.js', 'utils/*.js'],
                overwrite: true,                 // overwrite matched source files
                replacements: [{
                    from: 'console.log',
                    to: '//console.log'
                }]
            },
            dev: {
                src: ['routes/*.js', 'utils/*.js'],
                overwrite: true,                 // overwrite matched source files
                replacements: [{
                    from: '//console.log',
                    to: 'console.log'
                }]
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-jscs-checker');
    grunt.loadNpmTasks('grunt-shell');
    grunt.loadNpmTasks('grunt-text-replace');

    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-copy');

    grunt.loadNpmTasks('grunt-istanbul');
    grunt.loadNpmTasks('grunt-istanbul-coverage');

    grunt.registerTask('check', [
        'jshint', 'jscs', 'unitTest'
    ]);

    grunt.registerTask('unitTest',
        ['clean', 'instrument', 'copy', 'mochaTest', 'storeCoverage', 'makeReport', 'coverage']
    );

    grunt.registerTask('test', ['check']);

    grunt.registerTask('consoleOff', ['replace:pro']);
    grunt.registerTask('consoleOn', ['replace:dev']);

    grunt.registerTask('push', ['shell']);

    grunt.registerTask('default', []);
};
