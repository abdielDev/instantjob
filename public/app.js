var socket = io.connect("https://webdevbootcamp-piposlink.c9users.io", {"forceNew": true});

socket.on("messages", function(data) {
  console.log(data);
  render(data);
});

if ($("input[name='contraseñaConf']")) {
  $("input[name='contraseñaConf']").blur(function(){
    if ($("input[name='contraseñaConf']").val() !== $("input[name='contraseña']").val()) {
      $( ".password-alert" ).show();
      $(".purple").attr("disabled", true);
    } else {
      $( ".password-alert" ).hide();
      $(".purple").attr("disabled", false);
    }
  });
}

if ($("input[name='curriculum']")) {
  $("input[name='curriculum']").blur(function(){
    if ($("input[name='curriculum']").val() == "") {
      $( ".curriculum-alert" ).show();
      $(".purple").attr("disabled", true);
    } else {
      $( ".curriculum-alert" ).hide();
      $(".purple").attr("disabled", false);
    }
  });
}

if ($("input[name='logo']")) {
  $("input[name='logo']").blur(function(){
    if ($("input[name='logo']").val() == "") {
      $( ".logo-alert" ).show();
      $(".purple").attr("disabled", true);
    } else {
      $( ".curriculum-alert" ).hide();
      $(".purple").attr("disabled", false);
    }
  });
}
if ($("textarea[name='descripcion']")) {
  $("textarea[name='descripcion']").blur(function(){
    if ($("textarea[name='descripcion']").val().length < 100 ) {
      $( ".descripcion-alert" ).show();
      $(".purple").attr("disabled", true);
    } else {
      $( ".descripcion-alert" ).hide();
      $(".purple").attr("disabled", false);
    }
  });
}

function rfcValido(rfc, aceptarGenerico = true) {
    const re       = /^([A-ZÑ&]{3,4}) ?(?:- ?)?(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])) ?(?:- ?)?([A-Z\d]{2})([A\d])$/;
    var   validado = rfc.match(re);

    if (!validado)  //Coincide con el formato general del regex?
        return false;

    //Separar el dígito verificador del resto del RFC
    const digitoVerificador = validado.pop(),
          rfcSinDigito      = validado.slice(1).join(''),
          len               = rfcSinDigito.length,

    //Obtener el digito esperado
          diccionario       = "0123456789ABCDEFGHIJKLMN&OPQRSTUVWXYZ Ñ",
          indice            = len + 1;
    var   suma,
          digitoEsperado;

    if (len == 12) suma = 0
    else suma = 481; //Ajuste para persona moral

    for(var i=0; i<len; i++)
        suma += diccionario.indexOf(rfcSinDigito.charAt(i)) * (indice - i);
    digitoEsperado = 11 - suma % 11;
    if (digitoEsperado == 11) digitoEsperado = 0;
    else if (digitoEsperado == 10) digitoEsperado = "A";

    //El dígito verificador coincide con el esperado?
    // o es un RFC Genérico (ventas a público general)?
    if ((digitoVerificador != digitoEsperado)
     && (!aceptarGenerico || rfcSinDigito + digitoVerificador != "XAXX010101000"))
        return false;
    else if (!aceptarGenerico && rfcSinDigito + digitoVerificador == "XEXX010101000")
        return false;
    return rfcSinDigito + digitoVerificador;
}

if ($("input[name='rfc']")) {
  $("input[name='rfc']").blur(function(){
    validarInput($("input[name='rfc']"));
  });
}

//Handler para el evento cuando cambia el input
// -Lleva la RFC a mayúsculas para validarlo
// -Elimina los espacios que pueda tener antes o después
function validarInput(input) {
    var rfc         = input.val().trim().toUpperCase(),
        valido;

    var rfcCorrecto = rfcValido(rfc);   // ⬅️ Acá se comprueba

    if (rfcCorrecto) {
    	valido = "Válido";
      $(".alert-rfc").hide();
      $(".alert-rfc-good").show();
    } else {
    	valido = "No válido"
    	$(".alert-rfc").show();
      $(".alert-rfc-good").hide();
    }
}

if ($("input[name='terminos']")) {
  $("input[name='terminos']").change(function(){
    if ($("input[name='terminos']").is(":checked")) {
      $(".terms-field").hide();
      $(".purple").attr("disabled", false);
    } else {
      $(".terms-field").show();
      $(".purple").attr("disabled", true);
    }
  });
}

if ($( "input[name='correo']" )) {
  $( "input[name='correo']" ).blur(function() {
    socket.emit("mail", $( "input[name='correo']" ).val());
    socket.on("mailRet", function(data){
      if (data == true) {
        $( ".alert" ).show();
      } else {
        $( ".alert" ).hide();
      }
    });
  });
}


function render (data) {
  var html = data.map(function(elem, index) {
    return(`<div class="messagge">
              <span><strong>${elem.author}: </strong></span><span>${elem.text}</span>
            </div>`);
  }).join(" ");

  document.getElementById('messages').innerHTML = html;
}



function addMessage(e) {
  var message = {
    text: document.getElementById('texto').value
  };
  socket.emit("new-message", message);
  document.getElementById('texto').value = "";
  return false;
}
