var bodyParser  = require("body-parser"),
express         = require("express"),
mongoose        = require("mongoose"),
methodOverride  = require("method-override"),
app             = express(),
server          = require("http").Server(app),
io              = require("socket.io")(server),
session         = require("express-session"),
fileUpload      = require("express-fileupload"),
nodemailer      = require("nodemailer"),
crypto          = require("crypto"),
request         = require("request"),
validator       = require('validator'),
MongoStore      = require("connect-mongo")(session),
Schema          = mongoose.Schema;


//Database connection
mongoose.connect('mongodb://localhost:27017/instantjob', { useNewUrlParser: true });
app.use(session({
  secret: 'work hard',
  resave: true,
  saveUninitialized: false
}));
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended: true}));
app.use(fileUpload());
app.use(methodOverride("_method"));

var solicitanteSchema = new mongoose.Schema({
  nombre:         String,
  apellido:       String,
  edad:           Number,
  numero:         String,
  correo:         String,
  contraseña:     String,
  contraseñaConf: String,
  foto:           String,
  curriculum:     String,
  certificados:   String,
  verificado:     {type: Boolean, default: false},
  soporte:        Boolean
});

var tokenEmSchema = new mongoose.Schema({
  _idEmpresa: {type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Empresa'},
  token: {type: String, required: true},
  fecha: {type: Date, required: true, default: Date.now, expires: 43200}
});

var tokenSoSchema = new mongoose.Schema({
  _idSolicitante: {type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Solicitante'},
  token: {type: String, required: true},
  fecha: {type: Date, required: true, default: Date.now, expires: 43200}
});

solicitanteSchema.statics.authenticate = function (correo, contraseña, callback) {
  Solicitante.findOne({ correo: correo })
    .exec(function (err, solicitante) {
      if (err) {
        return callback(err)
      } else if (!solicitante) {
        var err = new Error('Cuenta no encontrada.');
        err.status = 401;
        return callback(err);
      }
      if (contraseña === solicitante.contraseña) {
        return callback(null, solicitante);
      } else {
        return callback();
      }
    });
}


// solicitanteSchema.pre("save", function(next) {
//   var solicitante = this;
//   bcrypt.hash(solicitante.contraseña, 10, function (err, hash) {
//     if (err) {
//       return next(err);
//     }
//     solicitante.contraseña = hash;
//     next();
//   });
// });

var solicitudSchema = new mongoose.Schema({
  fecha :      {type: Date, default: Date.now},
  solicitante: {type: Schema.Types.ObjectId, ref: 'Solicitante' },
  oferta:      {type: Schema.Types.ObjectId, ref: 'Oferta' }
});

var empresaSchema = new mongoose.Schema({
  nombre:         String,
  direccion:      String,
  correo:         String,
  descripcion:    String,
  logo:           String,
  imagenes:       String,
  contraseña:     String,
  confContraseña: String,
  rfc:            String,
  verificado:     { type: Boolean, default: false }
});

empresaSchema.statics.authenticate = function (correo, contraseña, callback) {
  Empresa.findOne({ correo: correo })
    .exec(function (err, empresa) {
      if (err) {
        return callback(err)
      } else if (!empresa) {
        var err = new Error('Cuenta no encontrada.');
        err.status = 401;
        return callback(err);
      }
      if (contraseña === empresa.contraseña) {
        return callback(null, empresa);
      } else {
        return callback();
      }
    });
}

// empresaSchema.pre("save", function(next) {
//   var empresa = this;
//   bcrypt.hash(empresa.contraseña, 10, function (err, hash) {
//     if (err) {
//       return next(err);
//     }
//     empresa.contraseña = hash;
//     next();
//   });
// });

var ofertaSchema = new mongoose.Schema({
  titulo:      String,
  descripcion: String,
  sueldo:      String,
  horario:     String,
  estado:      {type: Boolean, default: true},
  fecha:       {type: Date, default: Date.now},
  empresa:     {type: Schema.Types.ObjectId, ref: 'Empresa' }
});

var Solicitud   = mongoose.model("Solicitud", solicitudSchema);
var Solicitante = mongoose.model("Solicitante", solicitanteSchema);
var Empresa     = mongoose.model("Empresa", empresaSchema);
var Oferta      = mongoose.model("Oferta", ofertaSchema);
var TokenEm     = mongoose.model("TokenEm", tokenEmSchema);
var TokenSo     = mongoose.model("TokenSo", tokenSoSchema);

//Restful routes
app.get("/", function (req, res) {
  res.redirect('/login/u');
});

/***** Register routes *****/

//Nuevo usuario
app.get("/register/u", function(req, res) {
  if (req.session && req.session.userId) {
    res.redirect("/u/perfil")
  } else {
    res.render("nuevoUsuario", {session: req.session});
    io.once("connection", function(socket) {
      socket.on("mail", function(data) {
        Solicitante.findOne({correo: data}, function(err, solicitante) {
          if (!solicitante) {
            socket.emit("mailRet", false);
          }
          else {
            socket.emit("mailRet", true);
          }
        });
      });
    });
  }
});
app.get("/register/e", function(req, res) {
  if (req.session && req.session.userIdE) {
    res.redirect("/e/perfil");
  }
  res.render("nuevaEmpresa", {session: req.session});
  io.once("connection", function(socket) {
    socket.on("mail", function(data) {
      Empresa.findOne({correo: data}, function(err, empresa) {
        if (!empresa) {
          socket.emit("mailRet", false);
        }
        else {
          socket.emit("mailRet", true);
        }
      });
    });
  });
});

//Crear usuario
app.post("/register/e", function(req, res) {
  if (req.body.contraseña !== req.body.contraseñaConf) {
    var err = new Error('Las contraseñas no coinciden');
    err.status = 400;
    res.send("Las contraseñas no coinciden");
    return next(err);
  }
  if (validator.isEmpty(req.body.nombre)) {
    res.send("Olvidaste el campo nombre");
  }
  if (validator.isEmpty(req.body.rfc)) {
    res.send("RFC invalido");
  }
  if (validator.isEmpty(req.body.correo)) {
    res.send("Olvidatse el campo correo");
  }
  if (validator.isEmpty(req.body.direccion)) {
    res.send("Olvidaste el campo direccion");
  }
  if (validator.isEmpty(req.body.descripcion)) {
    res.send("Olvidaste el campo descripcion");
  }
  if (validator.isEmpty(req.body.contraseña)) {
    res.send("Olvidaste el campo contraseña");
  }
  if (validator.isEmpty(req.body.contraseñaConf)) {
    res.send("Olvidaste confirmar tu contraseña");
  }
  if (!req.files.logo) {
    res.send("Olvidaste el campo logo");
  }
  var imageName  = req.files.logo.name,
  image          = req.files.logo,
  nombre         = req.body.nombre,
  correo         = req.body.correo,
  direccion      = req.body.direccion,
  descripcion    = req.body.descripcion,
  rfc            = req.body.rfc,
  logo           = "img/" + imageName,
  contraseña     = req.body.contraseña,
  contraseñaConf = req.body.contraseñaConf,
  insertDir      = __dirname + "/public/img/" + imageName;
  var empresa = {
    nombre:         nombre,
    direccion:      direccion,
    descripcion:    descripcion,
    correo:         correo,
    logo:           logo,
    contraseña:     contraseña,
    contraseñaConf: contraseñaConf,
    rfc:            rfc
  };
  if(req.body['g-recaptcha-response'] === undefined || req.body['g-recaptcha-response'] === '' || req.body['g-recaptcha-response'] === null)
  {
    return res.json({"responseError" : "Seleccione el captcha porfavor"});
  }
  const secretKey = "6Lc0WX4UAAAAAC1jBRED5gjegagjubKu-9pscd0b";

  const verificationURL = "https://www.google.com/recaptcha/api/siteverify?secret=" + secretKey + "&response=" + req.body['g-recaptcha-response'] + "&remoteip=" + req.connection.remoteAddress;

  request(verificationURL,function(error,response,body) {
    body = JSON.parse(body);

    if(body.success !== undefined && !body.success) {
      return res.json({"responseError" : "Falló la verificación captcha"});
    }
    image.mv(insertDir, function(err) {
      if (err) {
        console.log(err);
      } else {
            Empresa.create(empresa, function(err, empresaCreada) {
              if (err) {
                console.log(err);
              } else {
                var token = new TokenEm({ _idEmpresa: empresaCreada._id, token: crypto.randomBytes(16).toString('hex') });
                token.save(function (err) {
                  if (err) {
                    console.log(err);
                  }
                  var transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: "instanjob.soporte@gmail.com", pass: "instanjob4524@" } });
                  var mailOptions = { from: 'no-reply@instantjob.com', to: empresaCreada.correo, subject: 'Token de verficación de cuenta', text: 'Hola,\n\n' + 'Porfavor verifica tu cuenta dando clic en el siguiente enlace: \nhttp:\/\/' + req.headers.host + '\/e/confirmation\/' + token.token + '.\n' };
                  transporter.sendMail(mailOptions, function (err) {
                    if (err) {
                      console.log(err);
                    } else {
                      res.send("El correo de verificacion fue enviado a " + empresaCreada.correo + ".\n Verifica tu bandeja de entrada");
                    }
                  });
                });
              }
            });
          }


    });
  });
});
app.post("/register/u", function(req, res) {
  if (req.body.contraseña !== req.body.contraseñaConf) {
    var err = new Error('Las contraseñas no coinciden');
    err.status = 400;
    res.send("Las contraseñas no coinciden");
    return next(err);
  }
  if (validator.isEmpty(req.body.nombre)) {
    res.send("Olvidaste el campo nombre");
  }
  if (validator.isEmpty(req.body.apellido)) {
    res.send("RFC invalido");
  }
  if (validator.isEmpty(req.body.correo)) {
    res.send("Olvidatse el campo correo");
  }
  if (validator.isEmpty(req.body.edad)) {
    res.send("Olvidaste el campo direccion");
  }
  if (validator.isEmpty(req.body.numero)) {
    res.send("Olvidaste el campo descripcion");
  }
  if (validator.isEmpty(req.body.contraseña)) {
    res.send("Olvidaste el campo contraseña");
  }
  if (validator.isEmpty(req.body.contraseñaConf)) {
    res.send("Olvidaste confirmar tu contraseña");
  }
  if (!req.files.curriculum) {
    res.send("Olvidaste el campo foto");
  }

  var imageName  = req.files.foto.name,
  image          = req.files.foto,
  pdfName        = req.files.curriculum.name,
  pdf            = req.files.curriculum;

  var nombreCortado = pdf.name.split(".");
  var extensionArchivo = nombreCortado[nombreCortado.length -1];

  var extensionesValidas = ["pdf"];

  if (extensionesValidas.indexOf(extensionArchivo) < 0) {
    res.send("Extensión no valida. \nLas extensiones validas son: " + extensionesValidas.join(", "));
  } else {
    pdfName = `${new Date().getMilliseconds()}.${extensionArchivo}`;

    var nombre     = req.body.nombre,
    correo         = req.body.correo,
    apellido       = req.body.apellido,
    edad           = req.body.edad,
    numero         = req.body.numero,
    foto           = "img/" + imageName,
    curriculum     = "pdf/" + pdfName,
    contraseña     = req.body.contraseña,
    contraseñaConf = req.body.contraseñaConf,
    insertImage    = __dirname + "/public/img/" + imageName,
    insertPdf      = __dirname + "/public/pdfs/" + pdfName;


    var solicitante = {
      nombre:         nombre,
      apellido:       apellido,
      edad:           edad,
      correo:         correo,
      numero:         numero,
      foto:           foto,
      curriculum:     curriculum,
      contraseña:     contraseña,
      contraseñaConf: contraseñaConf
    };
    if(req.body['g-recaptcha-response'] === undefined || req.body['g-recaptcha-response'] === '' || req.body['g-recaptcha-response'] === null)
    {
      return res.json({"responseError" : "Seleccione el captcha porfavor"});
    }
    const secretKey = "6Lc0WX4UAAAAAC1jBRED5gjegagjubKu-9pscd0b";

    const verificationURL = "https://www.google.com/recaptcha/api/siteverify?secret=" + secretKey + "&response=" + req.body['g-recaptcha-response'] + "&remoteip=" + req.connection.remoteAddress;

    request(verificationURL,function(error,response,body) {
      body = JSON.parse(body);

      if(body.success !== undefined && !body.success) {
        return res.json({"responseError" : "Falló la verificación captcha"});
      }
      image.mv(insertImage, function(err) {
        if (err) {
          console.log(err);
        } else {
          pdf.mv(insertPdf, function(err){
            if (err) {
              console.log(err);
            } else {
              image.mv(insertImage, function(err){
                if (err) {
                  console.log(err);
                } else {
                  Solicitante.create(solicitante, function(err, solicitanteCreado) {
                    if (err) {
                      console.log(err);
                    } else {
                      var token = new TokenSo({ _idSolicitante: solicitanteCreado._id, token: crypto.randomBytes(16).toString('hex') });
                      token.save(function (err) {
                        if (err) {
                          console.log(err);
                        }
                        var transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: "instanjob.soporte@gmail.com", pass: "instanjob4524@" } });
                        var mailOptions = { from: 'no-reply@instantjob.com', to: solicitanteCreado.correo, subject: 'Token de verficación de cuenta', text: 'Hola,\n\n' + 'Porfavor verifica tu cuenta dando clic en el siguiente enlace: \nhttp:\/\/' + req.headers.host + '\/u/confirmation\/' + token.token + '.\n' };
                        transporter.sendMail(mailOptions, function (err) {
                          if (err) {
                            console.log(err);
                          } else {
                            res.send("El correo de verificacion fue enviado a " + solicitanteCreado.correo + ".\n Verifica tu bandeja de entrada");
                          }
                        });
                      });
                    }
                  });
                }
              });
            }
          });
        }
      });
    });
  }
});

//Terminos y condiciones
app.get("/terms", function(req, res) {
  res.render("terminos");
});

//Nueva empresa route
app.get("/e/nuevo", function(req, res) {
  res.render("nuevaEmpresa", {session: req.session});
});

//Ruta de confirmación
app.get('/u/confirmation/:id', function(req, res) {
  TokenSo.findOne({ token: req.params.id}, function(err, token) {
    if (!token) {
      res.send("Token invalido");
    }
    else {
      Solicitante.findOne({ _id: token._idSolicitante}, function(err, solicitante) {
        if (!solicitante) {
          res.send("Este token ya ha sido utilizado");
        }
        else if (solicitante.verificado) {
          res.send("Usuario ya verificado");
        }
        else {
          solicitante.verificado = true;
          solicitante.save(function(err) {
            if (err) {
              res.send(err);
            }
            else {
              res.send("Tu correo ha sido verificado con exito. Ya puedes iniciar sesión");
            }
          });
        }
      });
    }
  });
});
app.get('/e/confirmation/:id', function(req, res) {
  TokenEm.findOne({ token: req.params.id}, function(err, token) {
    if (!token) {
      res.send("Token invalido");
    }
    else {
      Empresa.findOne({ _id: token._idEmpresa}, function(err, empresa) {
        if (!empresa) {
          res.send("Este token ya ha sido utilizado");
        }
        else if (empresa.verificado) {
          res.send("Usuario ya verificado");
        }
        else {
          empresa.verificado = true;
          empresa.save(function(err) {
            if (err) {
              res.send(err);
            }
            else {
              res.send("Tu correo ha sido verificado con exito. Ya puedes iniciar sesión");
            }
          });
        }
      });
    }
  });
});

//Crear empresa route


/***** Register routes END *****/

/***** Login route *****/

//Log user
app.get("/login/u", function(req, res) {
  if (req.session && req.session.userId) {
    res.redirect("/u/perfil")
  } else if(req.session && req.session.userIdE) {
    res.redirect("/e/perfil")
  } else {
    res.render("loginUsuario", {session: req.session});
  }
});
app.get("/login/e", function(req, res) {
  if (req.session && req.session.userIdE) {
    res.redirect("/e/perfil");
  } else {
    res.render("loginEmpresa", {session: req.session});
  }
});

app.post("/login/u", function(req, res) {
  Solicitante.authenticate(req.body.logCorreo, req.body.logContraseña, function (error, user) {
    if (error || !user) {
      var err = new Error('Wrong email or password.');
      err.status = 401;
      res.send("Tu contraseña o correo son incorrectos");
    }
      else if (!user.verificado) {
      res.send("Tu correo no ha sido verificado, porfavor revisa tu correo y confirmalo.")
      }
      else {
        req.session.userId = user._id;
        if (user.soporte) {
          return res.redirect("/soporte/u");
        }
        return res.redirect("/u/perfil");
      }
  });
});
app.post("/login/e", function(req, res) {
  Empresa.authenticate(req.body.logCorreo, req.body.logContraseña, function (error, user) {
    if (error || !user) {
      var err = new Error('Wrong email or password.');
      err.status = 401;
      res.send("La contraseña y el correo no coinciden");
    }
    else if (!user.verificado) {
      res.send("Tu correo no ha sido verificado, porfavor revisa tu correo y confirmalo.")
    }
    else {
        req.session.userIdE = user._id;
        return res.redirect("/e/perfil");
    }
  });
});

//log out
app.get('/logout', function(req, res, next) {
  if (req.session) {
    // delete session object
    req.session.destroy(function(err) {
      if(err) {
        return next(err);
      } else {
        return res.redirect('/');
      }
    });
  }
});

app.get("/recuperar", function(req, res) {
  res.render("recuperar", {session: req.session});
});

app.post("/recuperar", function(req, res) {
  Solicitante.findOne({correo: req.body.correo}, function(err, solicitante){
    if (!solicitante) {
      res.send("No existe ningun usuario vinculado a ese correo");
    }
    else if (err) {
      console.log(err);
    }
    else
    {
      var transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: "instanjob.soporte@gmail.com", pass: "instanjob4524@" } });
      var mailOptions = { from: 'no-reply@instantjob.com', to: solicitante.correo, subject: 'Recuperación de contraseña', text: 'Hola, que tal ' + solicitante.nombre + ',\n\n' + 'has solicitado un correo de recuperación de tu contraseña\n' + 'Tu contraseña es: ' + solicitante.contraseñaConf };
      transporter.sendMail(mailOptions, function (err) {
        if (err) {
          console.log(err);
        } else {
          res.send("El correo de verificacion fue enviado a " + solicitante.correo + ".");
        }
      });
    }
  });
});

/***** Login route END *****/

/***** Perfil Usuario *****/

app.get("/u/perfil", function(req, res) {
  if (req.session && req.session.userId) {
    Solicitante.findById(req.session.userId, function(err, usuario) {
      res.render("mostrarUsuario", {usuario: usuario, session: req.session});
    });
  } else {
    res.redirect("/login/u");
  }
});
app.get("/e/perfil", function(req, res) {
  if (req.session && req.session.userIdE) {
    Empresa.findById(req.session.userIdE, function(err, usuario) {
      res.render("mostrarEmpresa", {usuario: usuario, session: req.session});
    });
  } else {
    res.redirect("/login/e");
  }
});
app.get("/u/o", function(req, res) {
  if (req.session && req.session.userId) {
    Oferta.find({}, function(err, ofertas) {
      Solicitante.findById(req.session.userId, function(err, usuario){
        res.render("ofertas", {ofertas: ofertas, session: req.session, usuario: usuario});
      });
    });
  } else {
    res.redirect("/");
  }
});


/***** Perfil Usuario END *****/

/********** EMPRESAS ROUTES **********/

//Mostrar empresa route
// app.get("/e/:id", function(req, res) {
//   var id = parseInt(req.params.id);
//   Empresa.findById(req.params.id, function(err, empresaEncontrada){
//     if (err) {
//       res.redirect("/e");
//     } else {
//       res.render("mostrarEmpresas", {empresa: empresaEncontrada});
//     }
//   });
// });

//Editar empresa route
app.get("/e/:id/editar", function(req, res) {
  var id = req.params.id;
  if (req.session && req.session.userIdE) {
    Empresa.findById(req.params.id, function(err, usuario){
      if (err) {
        res.send(err);
      } else {
        res.render("editarEmpresa", {usuario: usuario, session: req.session.userIdE});
      }
    });
  } else {
    res.redirect("/login/e");
  }
});

//Actualizar empresa route
app.put("/e/:id", function(req, res) {
  var id = req.params.id;
  Empresa.findByIdAndUpdate(id, req.body.usuario, function(err, empresaActualizada){
    if (err) {
      res.redirect("/e/" + id + "/editar");
    } else {
      res.redirect("/e/perfil");
    }
  });
});

//Eliminar empresa routes
app.delete("/e/:id", function(req, res) {
  var id = req.params.id;
  Empresa.findByIdAndRemove(req.params.id, function(err) {
    if (err) {
      res.send("¡ocurrió un error");
    } else {
      res.redirect("/e");
    }
  });
});
app.delete("/e/o/:id", function(req, res) {
  var id = req.params.id;
  Oferta.findByIdAndRemove(req.params.id, function(err) {
    if (err) {
      res.send("¡ocurrió un error");
    } else {
      res.redirect("/e/o");
    }
  });
});

//Nueva oferta
app.get("/e/o/nueva", function(req, res) {
  if (req.session.userIdE && req.session) {
    Empresa.findById(req.session.userIdE, function(err, usuario){
      res.render("nuevaOferta", {session: req.session, usuario: usuario});
    });
  } else {
    res.redirect("/login/e");
  }
});

app.get("/e/o/:id/editar", function(req, res) {
  if (req.session.userIdE && req.session) {
    Empresa.findById(req.session.userIdE, function(err, usuario){
      Oferta.findById(req.params.id, function(err, oferta) {
        res.render("editarOferta", {session: req.session, usuario: usuario, oferta: oferta});
      })
    });
  } else {
    res.redirect("/login/e");
  }
});

app.put("/e/o/:id", function(req, res) {
  var id = req.params.id;
  req.body.oferta.horario = req.body.oferta.horarioIn + " a " + req.body.oferta.horarioFi;
  Oferta.findByIdAndUpdate(id, req.body.oferta, function(err, ofertaActualizada){
    if (err) {
      res.redirect("/e/" + id + "/editar");
    } else {
      res.redirect("/e/o/" + id);
    }
  });
});

//Crear oferta
app.post("/e/o", function(req, res) {
  var titulo    = req.body.oferta.titulo,
  descripcion   = req.body.oferta.descripcion,
  sueldo        = req.body.oferta.sueldo,
  horarioIn     = req.body.oferta.horarioIn,
  horarioFi     = req.body.oferta.horarioFi,
  horario       = horarioIn + " a " + horarioFi,
  body = {
    empresa: req.session.userIdE,
    titulo: titulo,
    descripcion: descripcion,
    sueldo: sueldo,
    horario: horario
  }

  Oferta.create(body, function(err, nuevaOferta){
    if (err) {
      console.log(err);
    } else {
      res.redirect("/e/o");
    }
  });
});

//Index ofertas
app.get("/e/o", function(req, res) {
  if (req.session.userIdE && req.session) {
    Oferta.find({}).populate("empresa").exec(function(err, ofertasEncontradas) {
      Empresa.findById(req.session.userIdE, function(err, usuario) {
        if (err) {
          res.send("¡Lo siento ocurrió un error!");
        } else {
          res.render("ofertasEm", {ofertas: ofertasEncontradas, session: req.session, usuario: usuario});
        }
      })
    });
  } else {
    res.redirect("/login/e");
  }
});


app.get('/descargar/:id', function(req, res){
  var file = __dirname + "/public/pdfs/" + req.params.id;
  res.sendFile(file); // Set disposition and send it.
});

//Mostrar oferta
app.get("/e/o/:id", function(req, res) {
  if (req.session.userIdE && req.session) {
    Oferta.findById(req.params.id, function(err, ofertaEncontrada) {
      if (err) {
        res.redirect("/perfil/e");
      } else {
        Solicitud.find({oferta: req.params.id}).populate("solicitante").exec(function(err, solicitudes) {
          Empresa.findById(req.session.userIdE, function(err, usuario) {
            solicitudes.forEach(function(solicitud) {
              var index = solicitud.solicitante.curriculum.indexOf("/") + 1;
              var newString = solicitud.solicitante.curriculum.substr(index);
              solicitud.solicitante.curriculum = newString;
            });
            res.render("mostrarOferta", {oferta: ofertaEncontrada, solicitudes:solicitudes, session: req.session, usuario: usuario});
          });
        });
      }
    });
  } else {
    res.redirect("/login/e");
  }
});


app.get("/u/e/:id", function(req, res) {
  if (req.session && req.session.userId) {
    Solicitante.findById(req.session.userId, function(err, usuario) {
      Empresa.findOne({_id: req.params.id}, function(err, empresa) {
        res.render("mostrarEmpresaU", {usuario: usuario, empresa: empresa, session: req.session});
      });
    });
  } else {
    res.redirect("/");
  }
});

app.get("/u/o/:id", function(req, res) {
  if (req.session && req.session.userId) {
    Oferta.findById(req.params.id).populate("empresa").exec(function(err, ofertaEncontrada) {
      Solicitante.findById(req.session.userId, function(err, usuario) {
        if (err) {
          res.redirect("/u");
        } else {
          res.render("mostrarOfertaU", {oferta: ofertaEncontrada, usuario: usuario, session: req.session});
        }
      })
    });
  } else {
    res.redirect("/");
  }
});
/********* AQUÍ TERMINA EMPRESAS ROUTES **********/
var messages = [{
  text: "Que tal estamos para servirle de 12:00 pm a 8:00 am",
  author: "Equipo de soporte"
}];

//Soporte usuario
app.get("/soporte/u", function(req, res) {
  if (req.session && req.session.userId) {
    Solicitante.findById(req.session.userId, function(err, usuario) {
      res.render("chat", {session: req.session, usuario: usuario});

      io.once("connection", function(socket) {
        console.log("Alguien se ha conectado!");
        socket.emit("messages", messages);
        socket.on("new-message", function(data) {
          data.author = usuario.nombre + " " + usuario.apellido;
          messages.push(data);
          io.sockets.emit("messages", messages);
        });
      });
    });
  } else {
    res.redirect("/")
  }
});

app.post("/u/o/:id", function(req, res) {
  var solicitud = {
    oferta: req.params.id,
    solicitante: req.session.userId
  };
  Solicitud.findOne({solicitante: solicitud.solicitante, oferta: solicitud.oferta}, function(err, solicitudEncontrada){
    if (solicitudEncontrada) {
      res.send("Ya estabas postulado");
    } else {
      Solicitud.create(solicitud, function(err, solicitudCreada) {
        if (err) {
          res.send(err);
        } else {
          res.redirect("/u/o");
        }
      });
    }
  });
});
/* Servidor escuchando */
server.listen(process.env.PORT, process.env.IP, function() {
  console.log("Servidor escuchando peticiones");
});
