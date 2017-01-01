//WWG Simple WebGL wrapper library
// Version 1.0 
// 2016 wakufactory.jp 
// license: MIT 

function WWG() {
	this.can = null ;
	this.gl = null ;
	this.vsize = {"float":1,"vec2":2,"vec3":3,"vec4":4,"mat2":4,"mat3":9,"mat4":16} ;
}
WWG.prototype.init = function(canvas) {
	this.can = canvas ;
	if(!((this.gl = canvas.getContext("experimental-webgl")) || (this.gl = canvas.getContext("webgl")))) { return false } ;
	this.ext_vao = this.gl.getExtension('OES_vertex_array_object');
	if(this.ext_vao == null){
		console.log('vertex array object not supported'); 
    	return false ;
    }
    this.ext_inst = this.gl.getExtension('ANGLE_instanced_arrays');
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
}
WWG.prototype.Render.prototype.setUnivec = function(type,pos,value) {
//	console.log("set "+type+"("+pos+") = "+value) ;
	switch(type) {
		case "mat2":
			this.gl.uniformMatrix2fv(pos,false,this.f32Array(value)) ;
			break ;
		case "mat3":
			this.gl.uniformMatrix3fv(pos,false,this.f32Array(value)) ;
			break ;
		case "mat4":
			this.gl.uniformMatrix4fv(pos,false,this.f32Array(value)) ;
			break ;
		case "vec2":
			this.gl.uniform2fv(pos, this.f32Array(value)) ;
			break ;
		case "vec3":
			this.gl.uniform3fv(pos, this.f32Array(value)) ;
			break ;
		case "vec4":
			this.gl.uniform4fv(pos, this.f32Array(value)) ;
			break ;
		case "int":
			this.gl.uniform1i(pos,value) ;
			break ;
		case "float":
			this.gl.uniform1f(pos,value) ;
			break ;
		case "sampler2D":
			this.gl.activeTexture(this.gl.TEXTURE0+value);
			this.gl.bindTexture(this.gl.TEXTURE_2D, this.texobj[value]);
			this.gl.uniform1i(pos,value) ;
			break ;
	}
}

WWG.prototype.Render.prototype.setShader = function(render) {
	function parse_shader(src) {
		var l = src.split("\n") ;
		var uni = [] ;
		var att = [] ;
		for(i=0;i<l.length;i++) {
			var ln = l[i] ;
			if( ln.match(/^\s*uniform\s*([0-9a-z]+)\s*([0-9a-z_]+)(\[[0-9]+\])?/i)) {
				uni.push( {type:RegExp.$1,name:RegExp.$2}) ;
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

		if(!render.vshader) { reject("no vshader") ;return false;}
		if(!render.fshader) { reject("no fshader") ;return false;}
		var vss ;
		var fss ;
		var pr = [] ;
		if(render.vshader.text ) vss = render.vshader.text ;
		else if(render.vshader.src) {
			pr.push( self.wwg.loadAjax(render.vshader.src).then(function(result) {
				vss = result ;
				resolve() ;
			}).catch(function(err) {
				reject(err) ;
			}))
		}
		if(render.fshader.text ) fss = render.fshader.text ;
		else if(render.fshader.src) {
			pr.push( self.wwg.loadAjax(render.fshader.src).then(function(result) {
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
				this.setUnivec(this.vs_uni[i].type, this.vs_uni[i].pos, data.vs_uni[i]) ;
			} else return false ;
		}
	}
	if(data.fs_uni) {
		for(var i in data.fs_uni) {
			if(this.fs_uni[i]) {
				this.setUnivec(this.fs_uni[i].type, this.fs_uni[i].pos, data.fs_uni[i]) ;
			} else return false ;
		}
	}
	return true ;
}
WWG.prototype.Render.prototype.genTex = function(img) {
	var gl = this.gl ;
	var tex = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, tex);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
	gl.generateMipmap(gl.TEXTURE_2D);
	//NEAREST LINEAR NEAREST_MIPMAP_NEAREST NEAREST_MIPMAP_LINEAR LINEAR_MIPMAP_NEAREST LINEAR_MIPMAP_LINEAR
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
//		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
//		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
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
				resolve( self.genTex(img) ) ;
			}
			img.onerror = function() {
				reject("cannot load image") ;
			}
			img.src = tex.src ;
		} else if(tex.img instanceof Image) {
			console.log("tex obj") ;
			resolve( self.genTex(tex.img) ) 
		} else if(tex.buffer) {
			console.log(tex.buffer);
			resolve( tex.buffer.fb.t) ;
		} else if(tex.canvas) {
			resolve( self.genTex(tex.canvas)) ;
		}
	})
}
WWG.prototype.Render.prototype.frameBuffer = function(width,height) {
	var gl = this.gl ;
	console.log("create framebuffer "+width+"x"+height) ;
	var frameBuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
	//depth
	var renderBuffer = gl.createRenderbuffer();
	gl.bindRenderbuffer(gl.RENDERBUFFER, renderBuffer);
	gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);	
	gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderBuffer);
	//texture
	var fTexture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, fTexture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fTexture, 0);
	gl.bindTexture(gl.TEXTURE_2D, null);
	gl.bindRenderbuffer(gl.RENDERBUFFER, null);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);	

	return {width:width,height:height,f:frameBuffer,d:renderBuffer,t:fTexture}
}
WWG.prototype.Render.prototype.setRender =function(render) {

	this.env = render.env ;
	this.render = render ;
	var self = this ;
	var gl = this.gl ;
	return new Promise(function(resolve,reject) {
		if(!gl) { reject("no init") ;return ;}
		var pr = [] ;
		self.setShader(render).then(function() {
			// load textures
			if(render.texture) {
				for(var i=0;i<render.texture.length;i++) {
					pr.push(self.loadTex( render.texture[i])) ;
				}
			}

			Promise.all(pr).then(function(result) {
//				console.log(result) ;
				self.texobj = result ;
				
				// set initial values
				if(!self.setUniValues(render)) {
					reject("no uniform name") ;
					return ;
				}
				if(self.env.cull) gl.enable(gl.CULL_FACE);
				gl.frontFace(gl.CCW);	
				if(!self.env.nodepth) gl.enable(gl.DEPTH_TEST);	
		
				//set model 
				for(var i =0;i<render.model.length;i++) {
					self.obuf[i] = self.setObj( render.model[i],true) ;
				}
//				console.log(self.obuf);
				
				if(self.env.offscreen) {// renderbuffer 
					self.fb = self.frameBuffer(self.env.offscreen.width,self.env.offscreen.height) ;	
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
	ret = {} ;
	vao = this.wwg.ext_vao.createVertexArrayOES() ;
	this.wwg.ext_vao.bindVertexArrayOES(vao);
	ret.vao = vao ;
	
	var vbo = this.gl.createBuffer() 
	this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vbo) ;

	var tl = 0 ;
	var ats = [] ;
	for(var i=0;i<obj.vtx_at.length;i++) {
		ats.push( this.vs_att[obj.vtx_at[i]] ) ;
		tl += this.wwg.vsize[this.vs_att[obj.vtx_at[i]].type] ;
	}
	tl = tl*4 ;
	var ofs = 0 ;
	for(var i in this.vs_att ) {
		this.gl.disableVertexAttribArray(this.vs_att[i].pos);
	}
	for(var i=0;i<ats.length;i++) {
		var s = this.wwg.vsize[ats[i].type] ;
		this.gl.enableVertexAttribArray(this.vs_att[ats[i].name].pos);
		this.gl.vertexAttribPointer(this.vs_att[ats[i].name].pos, s, this.gl.FLOAT, false, tl, ofs);
		ofs += s*4 ;	
	} 	
	ret.vbo = vbo ;

	if(obj.idx) {
		var ibo = this.gl.createBuffer() ;
		this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, ibo) ;
		ret.ibo = ibo ;
	}
	this.wwg.ext_vao.bindVertexArrayOES(null);

	this.wwg.ext_vao.bindVertexArrayOES(vao);
	if(flag) this.gl.bufferData(this.gl.ARRAY_BUFFER, 
		this.f32Array(obj.vtx), this.gl.STATIC_DRAW) ;
	if(flag && obj.idx) this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, 
		this.i16Array(obj.idx),this.gl.STATIC_DRAW ) ;

	this.wwg.ext_vao.bindVertexArrayOES(null);
		
	return ret ;
}

WWG.prototype.Render.prototype.setModel =function(models) {
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
		var cmodel = this.render.model[b] ;
		if(cmodel.hide) continue ;
		var uval = this.render ;
		this.setUniValues(this.render) ;
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
		var ofs = 0 ;
		this.wwg.ext_vao.bindVertexArrayOES(this.obuf[b].vao);

		switch(cmodel.mode) {
			case "tri_strip":
				if(cmodel.idx) gl.drawElements(this.gl.TRIANGLE_STRIP, cmodel.idx.length, this.gl.UNSIGNED_SHORT, ofs);
				else gl.drawArrays(gl.TRIANGLE_STRIP, ofs,cmodel.vtx.length/3);
				break ;
			case "tri":
				if(cmodel.idx) gl.drawElements(gl.TRIANGLES, cmodel.idx.length, this.gl.UNSIGNED_SHORT, ofs);
				else gl.drawArrays(gl.TRIANGLES, ofs,cmodel.vtx.length/3);		
				break ;
			case "points":
				if(cmodel.idx) gl.drawElements(gl.POINTS, cmodel.idx.length, this.gl.UNSIGNED_SHORT, ofs);
				else gl.drawArrays(gl.POINTS, ofs,cmodel.vtx.length/3);
				break ;
			case "lines":
				if(cmodel.idx) gl.drawElements(gl.LINES, cmodel.idx.length, this.gl.UNSIGNED_SHORT, ofs);
				else gl.drawArrays(this.gl.LINES, ofs,cmodel.vtx.length/3);
				break ;
			case "line_strip":
				if(cmodel.idx) gl.drawElements(gl.LINE_STRIP, cmodel.idx.length, this.gl.UNSIGNED_SHORT, ofs);
				else gl.drawArrays(gl.LINE_STRIP, ofs,cmodel.vtx.length/3);
				break ;
			default:
				console.log("Error: illigal draw mode") ;
				return false ;
		}
		this.wwg.ext_vao.bindVertexArrayOES(null);
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