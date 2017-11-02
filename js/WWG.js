//WWG Simple WebGL wrapper library
// Version 0.9 
// 2016-2017 wakufactory.jp 
// license: MIT 
// WWG
//   init(canvas)
//   init2(canvas)
//   loadAjax(src,opt)
//   loadImageAjax(src)
//   createRender()
// Render
//   setRender(scene)
//   draw(update,cls)
//   addModel(model)
//   updateModel(name,mode,buf)
//   addTex(texobj)
//   loadTex(tex)

function WWG() {
	this.version = "0.9.2" ;
	this.can = null ;
	this.gl = null ;
	this.vsize = {"float":1,"vec2":2,"vec3":3,"vec4":4,"mat2":4,"mat3":9,"mat4":16} ;
}
WWG.prototype.init = function(canvas,opt) {
	this.can = canvas ;
	var gl 
	if(!((gl = canvas.getContext("experimental-webgl",opt)) || (gl = canvas.getContext("webgl",opt)))) { return false } ;
	if(!window.Promise) return false ;
	this.gl = gl 
	this.ext_vao = gl.getExtension('OES_vertex_array_object');
	if(this.ext_vao) {
		this.vao_create = function(){return this.ext_vao.createVertexArrayOES()} ;
		this.vao_bind = function(o){this.ext_vao.bindVertexArrayOES(o)} ;
	}
	this.ext_inst = gl.getExtension('ANGLE_instanced_arrays');
	if(this.ext_inst) {
		this.inst_divisor = function(p,d){this.ext_inst.vertexAttribDivisorANGLE(p, d)}
		this.inst_draw = function(m,l,s,o,c){this.ext_inst.drawElementsInstancedANGLE(m,l, s, o, c);}
		this.inst_drawa = function(m,s,o,c) {this.ext_inst.drawArrayInstancedANGLE(m, s, o, c);}
	}
	this.ext_anis = gl.getExtension("EXT_texture_filter_anisotropic");
	this.ext_ftex = gl.getExtension('OES_texture_float');
	this.ext_mrt = gl.getExtension('WEBGL_draw_buffers');
	if(this.ext_mrt) {
		this.mrt_att = this.ext_mrt.COLOR_ATTACHMENT0_WEBGL ;
		this.mrt_draw = function(b,d){return this.ext_mrt.drawBuffersWEBGL(b,d)} ;
	}

	this.dmodes = {"tri_strip":gl.TRIANGLE_STRIP,"tri":gl.TRIANGLES,"points":gl.POINTS,"lines":gl.LINES,"line_strip":gl.LINE_STRIP }
	this.version = 1 ;
	return true ;
}
WWG.prototype.init2 = function(canvas,opt) {
	this.can = canvas ;
	var gl 
	if(!((gl = canvas.getContext("experimental-webgl2",opt)) || (gl = canvas.getContext("webgl2",opt)))) { return false } ;
	if(!window.Promise) return false ;
	console.log("init for webGL2") ;
	this.gl = gl ;
	
	this.ext_vao = true ;
	this.vao_create = function(){ return this.gl.createVertexArray()} ;
	this.vao_bind = function(o){this.gl.bindVertexArray(o)} ;
	this.inst_divisor = function(p,d){this.gl.vertexAttribDivisor(p, d)}
	this.inst_draw = function(m,l,s,o,c){this.gl.drawElementsInstanced(m,l, s, o, c);}
	this.inst_drawa = function(m,s,o,c) {this.gl.drawArrayInstanced(m, s, o, c);}
	this.ext_anis = gl.getExtension("EXT_texture_filter_anisotropic");
	this.ext_mrt = (gl.getParameter(gl.MAX_DRAW_BUFFERS)>1) ;
	if(this.ext_mrt) {
		this.mrt_att = gl.COLOR_ATTACHMENT0 ;
		this.mrt_draw =  function(b,d){return gl.drawBuffers(b,d)} ;
	}

	this.dmodes = {"tri_strip":gl.TRIANGLE_STRIP,"tri":gl.TRIANGLES,"points":gl.POINTS,"lines":gl.LINES,"line_strip":gl.LINE_STRIP }
	this.version = 2 ;
	return true ;
}
WWG.prototype.loadAjax = function(src,opt) {
	return new Promise(function(resolve,reject) {
		var req = new XMLHttpRequest();
		req.open("get",src,true) ;
		req.responseType = (opt && opt.type)?opt.type:"text" ;
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
WWG.prototype.loadImageAjax = function(src) {
	var self = this ;
	return new Promise(function(resolve,reject){
		self.loadAjax(src,{type:"blob"}).then(function(b){
			var timg = new Image ;
			timg.onload = function() {
				resolve(timg) ;
			}
			timg.src = URL.createObjectURL(b);
			b = null ;
		}).catch(function(err){
			resolve(null) ;
		})
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
//	console.log("set "+uni.type+"("+uni.pos+") = "+value) ;
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
		case "intv":
			this.gl.uniform1iv(uni.pos,this.i16Array(value)) ;
			break ;
		case "floatv":
			this.gl.uniform1fv(uni.pos,this.f32Array(value)) ;
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
			if(this.data.texture[value].video) {
				this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.data.texture[value].video);	
			}
			this.gl.uniform1i(uni.pos,uni.texunit) ;
			break ;
	}
}

WWG.prototype.Render.prototype.setShader = function(data) {
	var tu = 0 ;
	function parse_shader(src) {
		var l = src.split("\n") ;
		var uni = [] ;
		var att = [] ;

		for(i=0;i<l.length;i++) {
			var ln = l[i] ;
			if( ln.match(/^\s*uniform\s*([0-9a-z]+)\s*([0-9a-z_]+)(\[[^\]]+\])?/i)) {
				var u = {type:RegExp.$1,name:RegExp.$2} ;
				if(RegExp.$3!="") {
					u.type = u.type+"v" ;
				}
				if(u.type=="sampler2D") u.texunit = tu++ ;
				uni.push(u) ;
			}
			if( ln.match(/^\s*(?:attribute|in)\s*([0-9a-z]+)\s*([0-9a-z_]+)/i)) {
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
			var ret = {} ;
			var vshader = gl.createShader(gl.VERTEX_SHADER);
			gl.shaderSource(vshader, vss);
			gl.compileShader(vshader);
			if(!gl.getShaderParameter(vshader, gl.COMPILE_STATUS)) {
				reject("vs error:"+gl.getShaderInfoLog(vshader)); return false;
			}
			ret.vshader = vshader ;
		
			var fshader = gl.createShader(gl.FRAGMENT_SHADER);
			gl.shaderSource(fshader, fss);
			gl.compileShader(fshader);
			if(!gl.getShaderParameter(fshader, gl.COMPILE_STATUS)) {
				reject("fs error:"+gl.getShaderInfoLog(fshader)); return false;
			}
			ret.fshader = fshader ;
			
			var program = gl.createProgram();
			gl.attachShader(program, vshader);
			gl.attachShader(program, fshader);
			gl.linkProgram(program);
			if(!gl.getProgramParameter(program, gl.LINK_STATUS)) {
				reject("link error:"+gl.getProgramInfoLog(program)); return false;
			}
			ret.program = program ;
			gl.useProgram(program);
		
			var vr = parse_shader(vss) ;	
//			console.log(vr) ;
			ret.vs_att = {} ;	
			for(var i in vr.att) {
				vr.att[i].pos = gl.getAttribLocation(program,vr.att[i].name) ;
				ret.vs_att[vr.att[i].name] = vr.att[i] ;
			}
			ret.vs_uni = {} ;
			for(var i in vr.uni) {
				vr.uni[i].pos = gl.getUniformLocation(program,vr.uni[i].name) ;
				ret.vs_uni[vr.uni[i].name] = vr.uni[i] ;
			}
		
			var fr = parse_shader(fss) ;	
//			console.log(fr);	
			ret.fs_uni = {} ;
			for(var i in fr.uni) {
				fr.uni[i].pos = gl.getUniformLocation(program,fr.uni[i].name) ;
				ret.fs_uni[fr.uni[i].name] = fr.uni[i] ;
			}
			resolve(ret) ;
		}).catch(function(err){
			reject(err) ;
		}) ;
	})
}
WWG.prototype.Render.prototype.setUniValues = function(data) {
	if(data.vs_uni) {
		for(var i in data.vs_uni) {
			if(this.vs_uni[i]) {
				this.setUnivec(this.vs_uni[i], data.vs_uni[i]) ;
			}  ;
		}
	}
	if(data.fs_uni) {
		for(var i in data.fs_uni) {
			if(this.fs_uni[i]) {
				this.setUnivec(this.fs_uni[i], data.fs_uni[i]) ;
			}  ;
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
	if(!option.nomipmap) gl.generateMipmap(gl.TEXTURE_2D);
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
	if(option.repeat==2) {
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);		
	} else {
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
	}
	if(this.wwg.ext_anis && option.anisotropy) {
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
			if(tex.opt && tex.opt.cors) {
				self.wwg.loadImageAjax(tex.src).then(function(img) {
					resolve( self.genTex(img,tex.opt)) ;
				});
			} else {
				var img = new Image() ;
				img.onload = function() {
					resolve( self.genTex(img,tex.opt) ) ;
				}
				img.onerror = function() {
					reject("cannot load image") ;
				}
				img.src = tex.src ;
			}
		} else if(tex.img instanceof Image) {
			resolve( self.genTex(tex.img,tex.opt) ) 
		} else if(tex.video ) {
			resolve( self.genTex(tex.video,{nomipmap:true,flevel:0,repeat:2}) ) 
		} else if(tex.buffer) {
			if(tex.mrt!=undefined) {
				resolve( tex.buffer.fb.t[tex.mrt])
			}
			else resolve( tex.buffer.fb.t) ;
		} else if(tex.texture) {
			resolve( tex.texture) ;
		} else if(tex.canvas) {
			resolve( self.genTex(tex.canvas,tex.opt)) ;
		} else {
			reject("no image")
		}
	})
}
WWG.prototype.Render.prototype.addTex = function(texobj) {
	this.texobj.push(texobj) ;
	return this.texobj.length-1 ;
}
WWG.prototype.Render.prototype.frameBuffer = function(os) {
	var gl = this.gl ;
	console.log("create framebuffer "+os.width+"x"+os.height) ;
	var mrt = os.mrt ;
	var ttype = gl.UNSIGNED_BYTE ;
	var tfilter = gl.LINEAR ;
	if(this.wwg.ext_ftex && os.float ) {
		ttype = gl.FLOAT ;
		tfilter = gl.NEAREST ;
		console.log("use float tex") ;
	}
	var fblist = [] ;
	var frameBuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
	//depth
	var renderBuffer = gl.createRenderbuffer();
	gl.bindRenderbuffer(gl.RENDERBUFFER, renderBuffer);
	gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, os.width, os.height);	
	gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderBuffer);
	//texture
	if(mrt) {
		var fTexture = [] ;
		for(var i=0;i<mrt;i++) {
			fTexture[i] = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, fTexture[i]);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, os.width, os.height, 0, gl.RGBA, ttype, null);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, tfilter);
		    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, tfilter);
			gl.framebufferTexture2D(gl.FRAMEBUFFER, this.wwg.mrt_att + i, gl.TEXTURE_2D, fTexture[i], 0);	
			fblist.push(this.wwg.mrt_att + i)		
		}
	} else {
		var fTexture = gl.createTexture()
		gl.bindTexture(gl.TEXTURE_2D, fTexture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, os.width, os.height, 0, gl.RGBA, ttype, null);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, tfilter);
	    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, tfilter);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fTexture, 0);
	}
	gl.bindTexture(gl.TEXTURE_2D, null);
	gl.bindRenderbuffer(gl.RENDERBUFFER, null);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);	

	var ret = {width:os.width,height:os.height,f:frameBuffer,d:renderBuffer,t:fTexture}
	if(mrt) ret.fblist = fblist ;
	return ret ;
}
WWG.prototype.Render.prototype.setRender =function(data) {
	var gl = this.gl ;
	this.env = data.env ;
	this.data = data ;
	var self = this ;

	return new Promise(function(resolve,reject) {
		if(!gl) { reject("no init") ;return ;}
		var pr = [] ;
		self.setShader({fshader:data.fshader,vshader:data.vshader}).then(function(ret) {
			//set program
			self.vshader = ret.vshader ;
			self.fshader = ret.fshader ;
			self.program = ret.program ;
			self.vs_uni = ret.vs_uni ;
			self.vs_att = ret.vs_att ;
			self.fs_uni = ret.fs_uni ;
			
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
				
				if(self.env.cull) gl.enable(gl.CULL_FACE); else gl.disable(gl.CULL_FACE);
				if(self.env.face_cw) gl.frontFace(gl.CW); else gl.frontFace(gl.CCW);
				if(!self.env.nodepth) gl.enable(gl.DEPTH_TEST); else gl.disable(gl.DEPTH_TEST);		
		
				//set model 
				for(var i =0;i<data.model.length;i++) {
					self.obuf[i] = self.setObj( data.model[i],true) ;
				}
				self.modelCount = data.model.length ;
//				console.log(self.obuf);
				
				if(self.env.offscreen) {// renderbuffer 
					if(self.env.offscreen.mrt) { //MRT
						if(!self.wwg.ext_mrt) reject("MRT not support") ;
					}
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
		var vao = this.wwg.vao_create() ;
		this.wwg.vao_bind(vao);
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
			this.wwg.inst_divisor(pos, divisor)	
		} 
		ret.inst = ibuf 
	}
	
	if(this.wwg.ext_vao) this.wwg.vao_bind(null);

	if(this.wwg.ext_vao) this.wwg.vao_bind(vao);
	if(flag) {
		gl.bindBuffer(gl.ARRAY_BUFFER, vbo) ;
		gl.bufferData(gl.ARRAY_BUFFER, 
			this.f32Array(geo.vtx), (geo.dynamic)?gl.DYNAMIC_DRAW:gl.STATIC_DRAW) ;
	}
	if(flag && geo.idx) {
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo) ;
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, 
			this.i16Array(geo.idx),gl.STATIC_DRAW ) ;
	}
	if(flag && inst) {
		gl.bindBuffer(gl.ARRAY_BUFFER, ibuf) ;
		gl.bufferData(gl.ARRAY_BUFFER, 
			this.f32Array(inst.data),(inst.dynamic)?gl.DYNAMIC_DRAW:gl.STATIC_DRAW ) ;
	}
	if(this.wwg.ext_vao) this.wwg.vao_bind(null);
		
	return ret ;
}
WWG.prototype.Render.prototype.getModelIdx = function(name) {
	var idx = -1 ;
	if(typeof name != 'string') idx = parseInt(name) ;
	else {
		for(var i=0;i<this.data.model.length;i++) {
			if(this.data.model[i].name==name) break ;
		}
		idx =i ;
	}	
	return idx ;	
}
// add model
WWG.prototype.Render.prototype.addModel = function(model) {
	this.data.model.push(model) ;
	this.obuf.push(this.setObj(model,true)) ;
	this.modelCount = this.data.model.length ;
}
// update attribute buffer 
WWG.prototype.Render.prototype.updateModel = function(name,mode,buf) {
	var idx = this.getModelIdx(name) ;
	var obuf = this.obuf[idx] ;
	switch(mode) {
		case "vbo":	
			this.gl.bindBuffer(this.gl.ARRAY_BUFFER, obuf.vbo) ;
			break ;
		case "inst":
			this.gl.bindBuffer(this.gl.ARRAY_BUFFER, obuf.inst) ;
			break ;
	}
	this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, buf)	
}
WWG.prototype.Render.prototype.getModelData =function(name) {
	var idx = this.getModelIdx(name) ;
	return this.data.model[idx] ;
}
//update uniform values
WWG.prototype.Render.prototype.pushUniValues = function(u) {
	if(u.vs_uni) {
		for(var i in u.vs_uni) {
			this.update_uni.vs_uni[i] = u.vs_uni[i] ;
		}
	}
	if(u.fs_uni) {
		for(var i in u.fs_uni) {
			this.update_uni.fs_uni[i] = u.fs_uni[i] ;
		}
	}
}
WWG.prototype.Render.prototype.updateUniValues = function(u) {
	if(!u) {
		this.update_uni = {vs_uni:{},fs_uni:{}} ;
		return ;
	}
//	console.log(this.update_uni);
	this.setUniValues(this.update_uni)
}

// draw call
WWG.prototype.Render.prototype.draw = function(update,cls) {
//	console.log("draw");

	var gl = this.gl ;
	gl.useProgram(this.program);

	if(this.env.offscreen) {// renderbuffer 
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb.f);
		if(this.env.offscreen.mrt) this.wwg.mrt_draw(this.fb.fblist);
		gl.viewport(0,0,this.fb.width,this.fb.height) ;
	}
	if(!cls) this.clear() ;
	for(var b=0;b<this.obuf.length;b++) {
		var cmodel = this.data.model[b] ;
		if(cmodel.hide) continue ;
		var geo = cmodel.geo ;

		this.updateUniValues(null) ;
		this.pushUniValues(this.data) ;
		this.pushUniValues(cmodel);
		if(update) {
			// set modified values
			this.pushUniValues(update) ;
			if(update.model) {
				var model =update.model[b] ;
				if(model) this.pushUniValues(model) ;
			}
		}
		this.updateUniValues(1)

		var obuf = this.obuf[b] ;
		var ofs = 0 ;
		if(this.wwg.ext_vao)  this.wwg.vao_bind(obuf.vao);
		else {
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
					this.wwg.inst_divisor(pos, 1)	
				}
			}
		}
		if(cmodel.preFunction) {
			cmodel.preFunction(gl,cmodel,this.obuf[b]) ;
		}
		if(cmodel.blend!==undefined) {
			gl.enable(gl.BLEND) ;
			if(cmodel.blend=="alpha") gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE);
		}
		var gmode = this.wwg.dmodes[geo.mode]
		if(gmode==undefined) {
				console.log("Error: illigal draw mode") ;
				return false ;
		}
		if(cmodel.inst) {
			if(geo.idx) this.wwg.inst_draw(gmode, geo.idx.length, gl.UNSIGNED_SHORT, ofs, cmodel.inst.count);
			else this.wwg.inst_drawa(gmode, gl.UNSIGNED_SHORT, ofs, cmodel.inst.count);
		} else {
			if(geo.idx) gl.drawElements(gmode, geo.idx.length, gl.UNSIGNED_SHORT, ofs);
			else gl.drawArrays(gmode, ofs,geo.vtx.length/3);
		}
		if(this.wwg.ext_vao) this.wwg.vao_bind(null);
		else {
			
		}
		if(cmodel.blend!==undefined) {
			gl.disable(gl.BLEND) ;
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