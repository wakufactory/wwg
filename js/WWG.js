//WWG Simple WebGL wrapper library
// Version 0.9 
// 2016-2017 wakufactory.jp 
// license: MIT 

function WWG() {
	this.can = null ;
	this.gl = null ;
	this.vsize = {"float":1,"vec2":2,"vec3":3,"vec4":4,"mat2":4,"mat3":9,"mat4":16} ;
}
WWG.prototype.init = function(canvas) {
	this.can = canvas ;
	var gl 
	if(!((gl = canvas.getContext("experimental-webgl")) || (gl = canvas.getContext("webgl")))) { return false } ;
	this.gl = gl 
	this.ext_vao = gl.getExtension('OES_vertex_array_object');
	this.ext_inst = gl.getExtension('ANGLE_instanced_arrays');
	this.ext_anis = gl.getExtension("EXT_texture_filter_anisotropic");

	this.dmodes = {"tri_strip":gl.TRIANGLE_STRIP,"tri":gl.TRIANGLES,"points":gl.POINTS,"lines":gl.LINES,"line_strip":gl.LINE_STRIP }
	return true ;
}
WWG.prototype.loadAjax = function(src) {
	return new Promise(function(resolve,reject) {
		var req = new XMLHttpRequest();
		req.open("get",src,true) ;
		req.responseType = "text" ;
		req.onload = function() {
			if(this.status==200) {
				resolve(this.response) ;
			} else {
				reject("Ajax error:"+this.statusText) ;					
			}
		}
		req.onerror = function() {
			reject("Ajax error:"+this.statusText)
		}
		req.send() ;
	})
}
// Render unit
WWG.prototype.createRender = function() {
	return new this.Render(this) ;
}
WWG.prototype.Render = function(wwg) {
	this.wwg = wwg ;
	this.gl = wwg.gl ;
	this.env = {} ;
	this.obuf = [] ;
	this.modelCount = 0 ;
}
WWG.prototype.Render.prototype.setUnivec = function(uni,value) {
//	console.log("set "+type+"("+pos+") = "+value) ;
	switch(uni.type) {
		case "mat2":
			this.gl.uniformMatrix2fv(uni.pos,false,this.f32Array(value)) ;
			break ;
		case "mat3":
			this.gl.uniformMatrix3fv(uni.pos,false,this.f32Array(value)) ;
			break ;
		case "mat4":
			this.gl.uniformMatrix4fv(uni.pos,false,this.f32Array(value)) ;
			break ;
		case "vec2":
			this.gl.uniform2fv(uni.pos, this.f32Array(value)) ;
			break ;
		case "vec3":
			this.gl.uniform3fv(uni.pos, this.f32Array(value)) ;
			break ;
		case "vec4":
			this.gl.uniform4fv(uni.pos, this.f32Array(value)) ;
			break ;
		case "int":
			this.gl.uniform1i(uni.pos,value) ;
			break ;
		case "float":
			this.gl.uniform1f(uni.pos,value) ;
			break ;
		case "sampler2D":
			if(typeof value == 'string') {
				for(var i=0;i<this.data.texture.length;i++) {
					if(this.data.texture[i].name==value) break;
				}
				value = i ;
			}
			this.gl.activeTexture(this.gl.TEXTURE0+uni.texunit);
			this.gl.bindTexture(this.gl.TEXTURE_2D, this.texobj[value]);
			this.gl.uniform1i(uni.pos,uni.texunit) ;
			break ;
	}
}

WWG.prototype.Render.prototype.setShader = function(data) {
	function parse_shader(src) {
		var l = src.split("\n") ;
		var uni = [] ;
		var att = [] ;
		for(i=0;i<l.length;i++) {
			var ln = l[i] ;
			var tu = 0 ;
			if( ln.match(/^\s*uniform\s*([0-9a-z]+)\s*([0-9a-z_]+)(\[[0-9]+\])?/i)) {
				var u = {type:RegExp.$1,name:RegExp.$2} ;
				if(u.type=="sampler2D") u.texunit = tu++ ;
				uni.push(u) ;
			}
			if( ln.match(/^\s*attribute\s*([0-9a-z]+)\s*([0-9a-z_]+)/i)) {
				att.push( {type:RegExp.$1,name:RegExp.$2}) ;
			}
		}
		return {uni:uni,att:att} ;
	}

	var gl = this.gl ;
	var self = this ;
	return new Promise(function(resolve,reject) {
		if(!data.vshader) { reject("no vshader") ;return false;}
		if(!data.fshader) { reject("no fshader") ;return false;}
		var vss ;
		var fss ;
		var pr = [] ;
		if(data.vshader.text ) vss = data.vshader.text ;
		else if(data.vshader.src) {
			pr.push( self.wwg.loadAjax(data.vshader.src).then(function(result) {
				vss = result ;
				resolve() ;
			}).catch(function(err) {
				reject(err) ;
			}))
		}
		if(data.fshader.text ) fss = data.fshader.text ;
		else if(data.fshader.src) {
			pr.push( self.wwg.loadAjax(data.fshader.src).then(function(result) {
				fss = result ;
				resolve() ;
			}).catch(function(err) {
				reject(err) ;
			}))
		}
		Promise.all(pr).then(function(res) {
//			console.log(vss) ;
//			console.log(fss) ;
			var vshader = gl.createShader(gl.VERTEX_SHADER);
			gl.shaderSource(vshader, vss);
			gl.compileShader(vshader);
			if(!gl.getShaderParameter(vshader, gl.COMPILE_STATUS)) {
				reject("vs error:"+gl.getShaderInfoLog(vshader)); return false;
			}
			self.vshader = vshader ;
		
			var fshader = gl.createShader(gl.FRAGMENT_SHADER);
			gl.shaderSource(fshader, fss);
			gl.compileShader(fshader);
			if(!gl.getShaderParameter(fshader, gl.COMPILE_STATUS)) {
				reject("fs error:"+gl.getShaderInfoLog(fshader)); return false;
			}
			self.fshader = fshader ;
			
			var program = gl.createProgram();
			gl.attachShader(program, vshader);
			gl.attachShader(program, fshader);
			gl.linkProgram(program);
			if(!gl.getProgramParameter(program, gl.LINK_STATUS)) {
				reject("link error:"+gl.getProgramInfoLog(program)); return false;
			}
			self.program = program ;
			gl.useProgram(program);
		
			var vr = parse_shader(vss) ;	
//			console.log(vr) ;
			self.vs_att = {} ;	
			for(var i in vr.att) {
				vr.att[i].pos = gl.getAttribLocation(program,vr.att[i].name) ;
				self.vs_att[vr.att[i].name] = vr.att[i] ;
			}
			self.vs_uni = {} ;
			for(var i in vr.uni) {
				vr.uni[i].pos = gl.getUniformLocation(program,vr.uni[i].name) ;
				self.vs_uni[vr.uni[i].name] = vr.uni[i] ;
			}
		
			var fr = parse_shader(fss) ;	
//			console.log(fr);	
			self.fs_uni = {} ;
			for(var i in fr.uni) {
				fr.uni[i].pos = gl.getUniformLocation(program,fr.uni[i].name) ;
				self.fs_uni[fr.uni[i].name] = fr.uni[i] ;
			}
			resolve() ;
		}).catch(function(err){
			reject(err) ;
		}) ;
	})
}
WWG.prototype.Render.prototype.setUniValues = function(data) {
	this.gl.useProgram(this.program);
	if(data.vs_uni) {
		for(var i in data.vs_uni) {
			if(this.vs_uni[i]) {
				this.setUnivec(this.vs_uni[i], data.vs_uni[i]) ;
			} else return false ;
		}
	}
	if(data.fs_uni) {
		for(var i in data.fs_uni) {
			if(this.fs_uni[i]) {
				this.setUnivec(this.fs_uni[i], data.fs_uni[i]) ;
			} else return false ;
		}
	}
	return true ;
}
WWG.prototype.Render.prototype.genTex = function(img,option) {
	if(!option) option={flevel:0} ;
	var gl = this.gl ;
	var tex = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, tex);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
	gl.generateMipmap(gl.TEXTURE_2D);
	//NEAREST LINEAR NEAREST_MIPMAP_NEAREST NEAREST_MIPMAP_LINEAR LINEAR_MIPMAP_NEAREST LINEAR_MIPMAP_LINEAR
	switch(option.flevel) {
	case 0:
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		break;
	case 1:
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		break;
	case 2:
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		break;
	}
//		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
//		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
	if(this.wwg.ext_anis && option.anisotropy) {
		console.log("set anisotropy:"+option.anisotropy)
		gl.texParameteri(gl.TEXTURE_2D, this.wwg.ext_anis.TEXTURE_MAX_ANISOTROPY_EXT, option.anisotropy);
	}
	gl.bindTexture(gl.TEXTURE_2D, null);	
	return tex ;	
}
WWG.prototype.Render.prototype.loadTex = function(tex) {
//	console.log( tex);
	var self = this ;
	var gl = this.gl ;

	return new Promise(function(resolve,reject) {
		if(tex.src) {
			var img = new Image() ;
			img.onload = function() {
				resolve( self.genTex(img,tex.opt) ) ;
			}
			img.onerror = function() {
				reject("cannot load image") ;
			}
			img.src = tex.src ;
		} else if(tex.img instanceof Image) {
			console.log("tex obj") ;
			resolve( self.genTex(tex.img,tex.opt) ) 
		} else if(tex.buffer) {
			console.log(tex.buffer);
			resolve( tex.buffer.fb.t) ;
		} else if(tex.canvas) {
			resolve( self.genTex(tex.canvas,tex.opt)) ;
		}
	})
}
WWG.prototype.Render.prototype.frameBuffer = function(os) {
	var gl = this.gl ;
	console.log("create framebuffer "+os.width+"x"+os.height) ;
	var frameBuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
	//depth
	var renderBuffer = gl.createRenderbuffer();
	gl.bindRenderbuffer(gl.RENDERBUFFER, renderBuffer);
	gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, os.width, os.height);	
	gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderBuffer);
	//texture
	var fTexture = gl.createTexture()
	gl.bindTexture(gl.TEXTURE_2D, fTexture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, os.width, os.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fTexture, 0);
	gl.bindTexture(gl.TEXTURE_2D, null);
	gl.bindRenderbuffer(gl.RENDERBUFFER, null);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);	

	return {width:os.width,height:os.height,f:frameBuffer,d:renderBuffer,t:fTexture}
}
WWG.prototype.Render.prototype.setRender =function(data) {
	var gl = this.gl ;
	this.env = data.env ;
	this.data = data ;
	var self = this ;

	return new Promise(function(resolve,reject) {
		if(!gl) { reject("no init") ;return ;}
		var pr = [] ;
		self.setShader(data).then(function() {
			// load textures
			if(data.texture) {
				for(var i=0;i<data.texture.length;i++) {
					pr.push(self.loadTex( data.texture[i])) ;
				}
			}

			Promise.all(pr).then(function(result) {
//				console.log(result) ;
				self.texobj = result ;
				
				// set initial values
				if(!self.setUniValues(data)) {
					reject("no uniform name") ;
					return ;
				}
				if(self.env.cull) gl.enable(gl.CULL_FACE);
				if(self.env.face_cw) gl.frontFace(gl.CW);	
				if(!self.env.nodepth) gl.enable(gl.DEPTH_TEST);	
		
				//set model 
				for(var i =0;i<data.model.length;i++) {
					self.obuf[i] = self.setObj( data.model[i],true) ;
				}
				self.modelCount = data.model.length ;
//				console.log(self.obuf);
				
				if(self.env.offscreen) {// renderbuffer 
					self.fb = self.frameBuffer(self.env.offscreen) ;	
				}
				resolve(self) ;
				
			}).catch(function(err) {
				reject(err) ;
			})
		}).catch(function(err) {reject(err);})
	});
}
WWG.prototype.Render.prototype.clear = function() {
	var cc = this.env.clear_color ;
	this.gl.clearColor(cc[0],cc[1],cc[2],cc[3]);
	this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
}

WWG.prototype.Render.prototype.f32Array = function(ar) {
	if(ar instanceof Float32Array) return ar ;
	else return new Float32Array(ar) ;
}
WWG.prototype.Render.prototype.i16Array = function(ar) {
	if(ar instanceof Int16Array) return ar ;
	else return new Int16Array(ar) ;
}
WWG.prototype.Render.prototype.setObj = function(obj,flag) {
	var gl = this.gl
	var geo = obj.geo ;
	var inst = obj.inst ;
	ret = {} ;
	
	if(this.wwg.ext_vao) {
		var vao = this.wwg.ext_vao.createVertexArrayOES() ;
		this.wwg.ext_vao.bindVertexArrayOES(vao);
		ret.vao = vao ;
	}
	
	var vbo = gl.createBuffer() 
	gl.bindBuffer(gl.ARRAY_BUFFER, vbo) ;

	var tl = 0 ;
	var ats = [] ;
	for(var i=0;i<geo.vtx_at.length;i++) {
		ats.push( this.vs_att[geo.vtx_at[i]] ) ;
		tl += this.wwg.vsize[this.vs_att[geo.vtx_at[i]].type] ;
	}
	tl = tl*4 ;
	ret.ats = ats ;
	ret.tl = tl ;
	var ofs = 0 ;
	for(var i in this.vs_att ) {
		gl.disableVertexAttribArray(this.vs_att[i].pos);
	}
	for(var i=0;i<ats.length;i++) {
		var s = this.wwg.vsize[ats[i].type] ;
		gl.enableVertexAttribArray(this.vs_att[ats[i].name].pos);
		gl.vertexAttribPointer(this.vs_att[ats[i].name].pos, s, gl.FLOAT, false, tl, ofs);
		ofs += s*4 ;	
	} 	
	ret.vbo = vbo ;

	if(geo.idx) {
		var ibo = gl.createBuffer() ;
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo) ;
		ret.ibo = ibo ;
	}
	if(inst) {
		var ibuf = gl.createBuffer() 
		gl.bindBuffer(gl.ARRAY_BUFFER, ibuf) ;
		var tl = 0 ;
		var ats = [] ;
		for(var i=0;i<inst.attr.length;i++) {
			ats.push( this.vs_att[inst.attr[i]] ) ;
			tl += this.wwg.vsize[this.vs_att[inst.attr[i]].type] ;
		}
		tl = tl*4 ;
		ret.iats = ats ;
		ret.itl = tl ;
		var ofs = 0 ;
		for(var i=0;i<ats.length;i++) {
			var divisor = (inst.divisor)?inst.divisor[i]:1 ;
			var s = this.wwg.vsize[ats[i].type] ;
			var pos = this.vs_att[ats[i].name].pos
			gl.enableVertexAttribArray(pos);
			gl.vertexAttribPointer(pos, s, gl.FLOAT, false, tl, ofs);
			ofs += s*4 ;
			this.wwg.ext_inst.vertexAttribDivisorANGLE(pos, divisor)	
		} 
		ret.inst = ibuf 
	}
	
	if(this.wwg.ext_vao) this.wwg.ext_vao.bindVertexArrayOES(null);

	if(this.wwg.ext_vao) this.wwg.ext_vao.bindVertexArrayOES(vao);
	var dmode = (geo.dynamic)?gl.DYNAMIC_DRAW:gl.STATIC_DRAW
	if(flag) {
		gl.bindBuffer(gl.ARRAY_BUFFER, vbo) ;
		gl.bufferData(gl.ARRAY_BUFFER, 
			this.f32Array(geo.vtx), dmode) ;
	}
	if(flag && geo.idx) {
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo) ;
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, 
			this.i16Array(geo.idx),dmode ) ;
	}
	if(flag && inst) {
		gl.bindBuffer(gl.ARRAY_BUFFER, ibuf) ;
		gl.bufferData(gl.ARRAY_BUFFER, 
			this.f32Array(inst.data),dmode ) ;
	}
	if(this.wwg.ext_vao) this.wwg.ext_vao.bindVertexArrayOES(null);
		
	return ret ;
}

WWG.prototype.Render.prototype.getModelData =function(name) {
	var ret = null ;
	if(typeof name != 'string') return this.data.model[name] ;
	for(var i=0;i<this.data.model.length;i++) {
		if(this.data.model[i].name==name) { ret = this.data.model[i];break ;}
	}
	return ret ;
}

WWG.prototype.Render.prototype.draw = function(update,cls) {
//	console.log("draw");

	var gl = this.gl ;
	if(this.env.offscreen) {// renderbuffer 
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb.f);
		gl.viewport(0,0,this.fb.width,this.fb.height) ;
	}
	if(!cls) this.clear() ;
	for(var b=0;b<this.obuf.length;b++) {
		var cmodel = this.data.model[b] ;
		var geo = cmodel.geo ;

		if(cmodel.hide) continue ;
		var uval = this.data ;
		this.setUniValues(this.data) ;
		this.setUniValues(cmodel);
		if(update) {
			// set modified values
			this.setUniValues(update) ;
			if(update.model) {
				var model =update.model[b] ;
				if(model) this.setUniValues(model) ;
			}
		}
		if(cmodel.preFunction) {
			cmodel.preFunction(gl,cmodel) ;
		}
		var obuf = this.obuf[b] ;
		var ofs = 0 ;
		if(this.wwg.ext_vao)  this.wwg.ext_vao.bindVertexArrayOES(obuf.vao);
		else {
			console.log("no vao") 
			gl.bindBuffer(gl.ARRAY_BUFFER, obuf.vbo) ;
			var aofs = 0 ;
			for(var i in this.vs_att ) {
				gl.disableVertexAttribArray(this.vs_att[i].pos);
			}
			for(var i=0;i<obuf.ats.length;i++) {
				var s = this.wwg.vsize[obuf.ats[i].type] ;
				gl.enableVertexAttribArray(this.vs_att[obuf.ats[i].name].pos);
				gl.vertexAttribPointer(this.vs_att[obuf.ats[i].name].pos, s, gl.FLOAT, false, obuf.tl, aofs);
				aofs += s*4 ;	
			}
			if(this.obuf[b].ibo) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.obuf[b].ibo) ;
			if(this.obuf[b].inst) {
				gl.bindBuffer(gl.ARRAY_BUFFER, this.obuf[b].inst) ;
				var aofs = 0 ;
				for(var i=0;i<obuf.iats.length;i++) {
//					var divisor = (inst.divisor)?inst.divisor[i]:1 ;
					var s = this.wwg.vsize[obuf.iats[i].type] ;
					var pos = this.vs_att[obuf.iats[i].name].pos
					gl.enableVertexAttribArray(pos);
					gl.vertexAttribPointer(pos, s, gl.FLOAT, false, obuf.itl, aofs);
					aofs += s*4 ;
					this.wwg.ext_inst.vertexAttribDivisorANGLE(pos, 1)	
				}
			}
		}
		var gmode = this.wwg.dmodes[geo.mode]
		if(!gmode) {
				console.log("Error: illigal draw mode") ;
				return false ;
		}
		if(cmodel.inst) {
			if(geo.idx) this.wwg.ext_inst.drawElementsInstancedANGLE(gmode, geo.idx.length, gl.UNSIGNED_SHORT, ofs, cmodel.inst.count);
			else this.wwg.ext_inst.drawArrayInstancedANGLE(gmode, gl.UNSIGNED_SHORT, ofs, cmodel.inst.count);
		} else {
			if(geo.idx) gl.drawElements(gmode, geo.idx.length, gl.UNSIGNED_SHORT, ofs);
			else gl.drawArrays(gmode, ofs,geo.vtx.length/3);
		}
		if(this.wwg.ext_vao) this.wwg.ext_vao.bindVertexArrayOES(null);
		else {
			
		}
		if(cmodel.postFunction) {
			cmodel.postFunction(gl,cmodel) ;
		}
	}
	if(this.env.offscreen) {// unbind renderbuffer 
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0,0,this.wwg.can.width,this.wwg.can.height) ;
	}
	return true ;
}