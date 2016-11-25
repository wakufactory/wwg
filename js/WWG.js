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
//	console.log("set "+type+" = "+value) ;
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
			if( ln.match(/^\s*uniform\s*([0-9a-z]+)\s*([0-9a-z_]+)/i)) {
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
	
		var vshader = gl.createShader(gl.VERTEX_SHADER);
		gl.shaderSource(vshader, render.vshader.src);
		gl.compileShader(vshader);
		if(!gl.getShaderParameter(vshader, gl.COMPILE_STATUS)) {
			reject("vs error:"+gl.getShaderInfoLog(vshader)); return false;
		}
		self.vshader = vshader ;
	
		var fshader = gl.createShader(gl.FRAGMENT_SHADER);
		gl.shaderSource(fshader, render.fshader.src);
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
	
		var vr = parse_shader(render.vshader.src) ;	
	//		console.log(vr) ;
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
	
		var fr = parse_shader(render.fshader.src) ;		
	//		console.log(fr) ;
		self.fs_uni = {} ;
		for(var i in fr.uni) {
			fr.uni[i].pos = gl.getUniformLocation(program,fr.uni[i].name) ;
			self.fs_uni[fr.uni[i].name] = fr.uni[i] ;
		}
		resolve() ;
	})
}
WWG.prototype.Render.prototype.setUniValues = function(data) {
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
WWG.prototype.Render.prototype.loadTex = function(tex) {
	var self = this ;
	var gl = this.gl ;
	function texobj(img) {
		var tex = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
		gl.generateMipmap(gl.TEXTURE_2D);
		gl.bindTexture(gl.TEXTURE_2D, null);	
		return tex ;	
	}
	return new Promise(function(resolve,reject) {
		if(tex.src) {
			var img = new Image() ;
			img.onload = function() {
				resolve( texobj(img) ) ;
			}
			img.onerror = function() {
				reject("cannot load image") ;
			}
			img.src = tex.src ;
		} else if(tex.img instanceof Image) {
			resolve( texobj(tex.img) ) 
		}
	})
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
				self.texobj = result ;
				
				// set initial values
				if(!self.setUniValues(render)) {
					reject("no uniform name") ;
					return ;
				}
//				gl.enable(gl.CULL_FACE);
				gl.frontFace(gl.CCW);	
				gl.enable(gl.DEPTH_TEST);	
		
				//set model 
				for(var i =0;i<render.model.length;i++) {
					self.obuf[i] = self.setObj( render.model[i],true) ;
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
	if(flag) this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, 
		this.i16Array(obj.idx),this.gl.STATIC_DRAW ) ;

	this.wwg.ext_vao.bindVertexArrayOES(null);
		
	return ret ;
}

WWG.prototype.Render.prototype.setModel =function(models) {
}

WWG.prototype.Render.prototype.draw = function(update,cls) {

	if(!cls) this.clear() ;
	for(var b=0;b<this.obuf.length;b++) {
		var cmodel = this.render.model[b] ;
		this.wwg.ext_vao.bindVertexArrayOES(this.obuf[b].vao);
		this.setUniValues(cmodel) ;
		if(update) {
			var model =update[b] ;
			// set modified values
			if(model) this.setUniValues(model) ;
		}

		switch(cmodel.mode) {
			case "tri_strip":
				this.gl.drawElements(this.gl.TRIANGLE_STRIP, cmodel.idx.length, this.gl.UNSIGNED_SHORT, 0);
				break ;
		}
	}
}