function WWG() {
	this.can = null ;
	this.gl = null ;
	this.env = {} ;
	this.vsize = {"vec2":2,"vec3":3,"vec4":4,"mat4":16} ;
	this.obuf = [] ;
}
WWG.prototype.init = function(canvas) {
	this.can = canvas ;
	if(!((this.gl = canvas.getContext("experimental-webgl")) || (this.gl = canvas.getContext("webgl")))) { return false } ;
	this.ext_vao = this.gl.getExtension('OES_vertex_array_object');
	if(this.ext_vao == null){
		console.log('vertex array object not supported'); 
    	return false ;
    }
	return true ;
}

WWG.prototype.setUnivec = function(type,pos,value) {
//	console.log("set "+type+" = "+value) ;
	switch(type) {
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
	}
}

WWG.prototype.setRender =function(render) {
	function parse_shader(src) {
		var l = src.split(";") ;
		var uni = [] ;
		var att = [] ;
		for(i=0;i<l.length;i++) {
			var ln = l[i] ;
			if( ln.match(/^\s*uniform ([0-9a-z]+) ([0-9a-z]+)/i)) {
				uni.push( {type:RegExp.$1,name:RegExp.$2}) ;
			}
			if( ln.match(/^\s*attribute ([0-9a-z]+) ([0-9a-z]+)/i)) {
				att.push( {type:RegExp.$1,name:RegExp.$2}) ;
			}
		}
		return {uni:uni,att:att} ;
	}
	this.env = render.env ;
	this.render = render ;
	var self = this ;
	var gl = this.gl ;
	return new Promise(function(resolve,reject) {
		if(!gl) { reject("no init") ;return ;}
		if(!render.vshader) { reject("no vshader") ;return ;}
		if(!render.fshader) { reject("no fshader") ;return ;}

		var vshader = gl.createShader(gl.VERTEX_SHADER);
		gl.shaderSource(vshader, render.vshader.src);
		gl.compileShader(vshader);
		if(!gl.getShaderParameter(vshader, gl.COMPILE_STATUS)) {
			reject("vs error:"+gl.getShaderInfoLog(vshader)); return ;
		}
		self.vshader = vshader ;

		var fshader = gl.createShader(gl.FRAGMENT_SHADER);
		gl.shaderSource(fshader, render.fshader.src);
		gl.compileShader(fshader);
		if(!gl.getShaderParameter(fshader, gl.COMPILE_STATUS)) {
			reject("fs error:"+gl.getShaderInfoLog(fshader)); return ;
		}
		self.fshader = fshader ;
		
		var program = gl.createProgram();
		gl.attachShader(program, vshader);
		gl.attachShader(program, fshader);
		gl.linkProgram(program);
		if(!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			reject("link error:"+gl.getProgramInfoLog(program)); return;
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
		
		// set initial values
		for(var i in render.vs_uni) {
			if(self.vs_uni[i]) {
				self.setUnivec(self.vs_uni[i].type, self.vs_uni[i].pos, render.vs_uni[i]) ;
			}
		}
		for(var i in render.fs_uni) {
			if(self.fs_uni[i]) {
				self.setUnivec(self.fs_uni[i].type, self.fs_uni[i].pos, render.fs_uni[i]) ;
			}
		}
//		gl.enable(gl.CULL_FACE);
		gl.frontFace(gl.CW);	
		gl.enable(gl.DEPTH_TEST);	

		//set model 
		for(var i =0;i<render.model.length;i++) {
			self.obuf[i] = self.setObj( render.model[i],true) ;
		}
		resolve(self) ;
	});
}
WWG.prototype.clear = function() {
	var cc = this.env.clear_color ;
	this.gl.clearColor(cc[0],cc[1],cc[2],cc[3]);
	this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
}

WWG.prototype.f32Array = function(ar) {
	if(ar instanceof Float32Array) return ar ;
	else return new Float32Array(ar) ;
}
WWG.prototype.i16Array = function(ar) {
	if(ar instanceof Int16Array) return ar ;
	else return new Int16Array(ar) ;
}
WWG.prototype.setObj = function(obj,flag) {
	ret = {} ;
	vao = this.ext_vao.createVertexArrayOES() ;
	this.ext_vao.bindVertexArrayOES(vao);
	ret.vao = vao ;
	
	var vbo = this.gl.createBuffer() 
	this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vbo) ;

	var tl = 0 ;
	var ats = [] ;
	for(var i=0;i<obj.vtx_at.length;i++) {
		ats.push( this.vs_att[obj.vtx_at[i]] ) ;
		tl += this.vsize[this.vs_att[obj.vtx_at[i]].type] ;
	}
	tl = tl*4 ;
	var ofs = 0 ;
	for(var i=0;i<ats.length;i++) {
		var s = this.vsize[ats[i].type] ;
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
	this.ext_vao.bindVertexArrayOES(null);

	this.ext_vao.bindVertexArrayOES(vao);
	if(flag) this.gl.bufferData(this.gl.ARRAY_BUFFER, 
		this.f32Array(obj.vtx), this.gl.STATIC_DRAW) ;
	if(flag) this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, 
		this.i16Array(obj.idx),this.gl.STATIC_DRAW ) ;

	this.ext_vao.bindVertexArrayOES(null);
		
	return ret ;
}

WWG.prototype.setModel =function(models) {
}

WWG.prototype.draw = function(models,cls) {

	if(!cls) this.clear() ;
	for(var b=0;b<this.obuf.length;b++) {
		this.ext_vao.bindVertexArrayOES(this.obuf[b].vao);
		
		if(models) {
		var model =models[b] ;
		
		// set modified values
		if(model.vs_uni) {
			for(var i in model.vs_uni) {
				if(this.vs_uni[i]) {
					this.setUnivec(this.vs_uni[i].type, this.vs_uni[i].pos, model.vs_uni[i]) ;
				}
			}
		}
		if(model.fs_uni) {
			for(var i in model.fs_uni) {
				if(this.fs_uni[i]) {
					this.setUnivec(this.fs_uni[i].type, this.fs_uni[i].pos, model.fs_uni[i]) ;
				}
			}
		}
		}
		this.gl.drawElements(this.gl.TRIANGLE_STRIP, 4, this.gl.UNSIGNED_SHORT, 0);
	}
}