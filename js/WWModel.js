//Model library for WWG
// Version 0.9 
// 2016-2017 wakufactory.jp 
// license: MIT 

WWModel = function(){
	
}
WWModel.prototype.loadAjax = function(src) {
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
// load .obj file
WWModel.prototype.loadObj = function(path,scale) {
	var self = this ;
	if(!scale) scale=1.0 ;
	return new Promise(function(resolve,reject) {
		self.loadAjax(path).then(function(data) {
//			console.log(data) ;
			var l = data.split("\n") ;
			var v = [];
			var n = [] ;
			var x = [] ;
			var t = [] ;
			var xi = {} ;
			var xic = 0 ;

			for(var i = 0;i<l.length;i++) {
				if(l[i].match(/^#/)) continue ;
				if(l[i].match(/^eof/)) break ;
				var ll = l[i].split(/\s+/) ;
				if(ll[0] == "v") {
					v.push([ll[1]*scale,ll[2]*scale,ll[3]*scale]) ;
				}
				if(ll[0] == "vt") {
					t.push([ll[1],ll[2]]) ;
				}
				if(ll[0] == "vn") {
					n.push([ll[1],ll[2],ll[3]]) ;
				}
				if(ll[0] == "f") {
					var ix = [] ;
					for(var ii=1;ii<ll.length;ii++) {
						if(ll[ii]=="") continue ;
						if(!(ll[ii] in xi)) xi[ll[ii]] = xic++ ; 
						ix.push(xi[ll[ii]]) ;
					}
					x.push(ix) ;
				}
			}
			self.obj_v = [] ;
			self.obj_i =x ;
			if(n.length>0) self.obj_n = [] ;
			if(t.length>0) self.obj_t = [] ;
			for(var i in xi) {
				var si = i.split("/") ;
				var ind = xi[i] ;
				self.obj_v[ind] = v[si[0]-1] ;
				if(t.length>0) self.obj_t[ind] = t[si[1]-1] ;
				if(n.length>0) self.obj_n[ind] = n[si[2]-1] ;
			}
			console.log("loadobj "+path+" vtx:"+v.length+" norm:"+n.length+" tex:"+t.length+" idx:"+x.length+" vbuf:"+self.obj_v.length) ;
			resolve(self) ;
		}).catch(function(err) {
			reject(err) ;
		})
	}) ;
}
//convert vtx data to vbo array
WWModel.prototype.objModel  = function(addvec,mode) {
	var v = this.obj_v ;
	var s = this.obj_i ;
	var n = this.obj_n ;
	var t = this.obj_t ;

	var vbuf = [] ;
	var ibuf = [] ;
	var sf = [] ;
	var sn = [] ;
	var ii = 0 ;
	if(!n) this.obj_n = [] ;

	for(var i=0;i<s.length;i++) {
		var p = s[i] ;
		if(!n) {
			//面法線算出
			var pa = [] ;
			for(var j=0;j<3;j++) {
				pa[j] = v[p[j]] ;
			}
			var yx = pa[1][0]-pa[0][0];
			var yy = pa[1][1]-pa[0][1];
			var yz = pa[1][2]-pa[0][2];
			var zx = pa[2][0]-pa[0][0];
			var zy = pa[2][1]-pa[0][1];
			var zz = pa[2][2]-pa[0][2];				
			var xx =  yy * zz - yz * zy;
			var xy = -yx * zz + yz * zx;
			var xz =  yx * zy - yy * zx;
			var vn = Math.sqrt(xx*xx+xy*xy+xz*xz) ;
			xx /= vn ; xy /= vn ; xz /= vn ;
			sf.push( [xx,xy,xz]) ;
			//面リスト
			for(var j=0;j<p.length;j++) {
				if(!sn[p[j]]) sn[p[j]] = [] ;
				sn[p[j]].push(i) ;
			}
		}
		//3角分割
		for(var j=1;j<p.length-1;j++) {
			ibuf.push(p[0]) ;
			ibuf.push(p[j]) ;
			ibuf.push(p[j+1] ) ;
		}
		ii += p.length ;
	}
	console.log(" poly:"+ibuf.length/3);
	for(var i=0;i<v.length;i++) {
		vbuf.push( v[i][0] ) ;
		vbuf.push( v[i][1] ) ;
		vbuf.push( v[i][2] ) ;
		var nx=0,ny=0,nz=0 ;		
		if(n) {
			nx = n[i][0] ;
			ny = n[i][1] ;
			nz = n[i][2] ;
		} else {
			//面法線の合成
			for(var j=0;j<sn[i].length;j++) {
				var ii = sn[i][j] ;
				nx += sf[ii][0] ;
				ny += sf[ii][1] ;
				nz += sf[ii][2] ;
			}
		}
		var vn = Math.sqrt(nx*nx+ny*ny+nz*nz) ;
		vbuf.push(nx/vn) ;
		vbuf.push(ny/vn) ;
		vbuf.push(nz/vn) ;
		if(!n) {
			this.obj_n.push([nx/vn,ny/vn,nz/vn]); 
		}
		if(t) {
			vbuf.push(t[i][0]) ;
			vbuf.push(t[i][1]) ;
		}
		if(addvec) {
			for(av=0;av<addvec.length;av++) {
				vbuf = vbuf.concat(addvec[av].data[i]) ;
			}
		}
	}
//	console.log(vbuf) ;
//	console.log(ibuf) ;
	this.ibuf = ibuf ;
	this.vbuf = vbuf ;
	var ret = {mode:"tri",vtx_at:["position","norm"],vtx:vbuf,idx:ibuf} ;
	if(t) ret.vtx_at.push("uv") ;
	if(addvec) {
		for(av=0;av<addvec.length;av++) ret.vtx_at.push(addvec[av].attr) ;
	}
	return ret ;
}
// generate normal vector lines
WWModel.prototype.normLines = function() {
	var nv = [] ;
	var v = this.obj_v
	var n = this.obj_n ;
	var vm = 0.1
	for(var i=0;i<v.length;i++) {
		nv.push(v[i][0]) ;
		nv.push(v[i][1]) ;
		nv.push(v[i][2]) ;
		nv.push(v[i][0]+n[i][0]*vm) ;
		nv.push(v[i][1]+n[i][1]*vm) ;
		nv.push(v[i][2]+n[i][2]*vm) ;
	}
	return  {mode:"lines",vtx_at:["position"],vtx:nv} ;
}
// mult 4x4 matrix
WWModel.prototype.multMatrix4 = function(m4) {
	
}
WWModel.prototype.mergeModels = function(models) {
	var m = this ;
	var ofs = 0 ;
	for(var i=0;i<models.length;i++) {
		m.obj_v = m.obj_v.concat(models[i].obj_v) 
		m.obj_n = m.obj_n.concat(models[i].obj_n) 
		m.obj_t = m.obj_t.concat(models[i].obj_t)
		for(var j=0;j<models[i].obj_i.length;j++) {
			var p = models[i].obj_i[j] ;
			var pp = [] ;
			for( n=0;n<p.length;n++) {
				pp.push( p[n]+ofs ) ;
			}
			m.obj_i.push(pp) ;
		}
		ofs += models[i].obj_v.length ;
	}
	return m ;
}
// generate primitive
WWModel.prototype.primitive  = function(type,param) {
	if(!param) param = {} ;
	var wx = (param.wx)?param.wx:1.0 ;
	var wy = (param.wy)?param.wy:1.0 ;
	var wz = (param.wz)?param.wz:1.0 ;
	var div = (param.div)?param.div:10 ;
	var ninv = (param.ninv)?-1:1 ;
	var p = [] ;
	var n = [] ;
	var t = [] ;
	var s = [] ;
	var PHI = Math.PI *2 ;
	switch(type) {
	case "sphere":
		for(var i = 0 ; i <= div ; ++i) {
			var v = i / (0.0+div);
			var y = Math.cos(Math.PI * v), r = Math.sin(Math.PI * v);
			for(var j = 0 ; j <= div*2 ; ++j) {
				var u = j / (0.0+div*2) ;
				var x = (Math.cos(PHI * u) * r)
				var z = (Math.sin(PHI * u) * r)
				p.push([x*wx,y*wy,z*wz])
				n.push([x*ninv,y*ninv,z*ninv])
				t.push([1-u,1-v])
			}
		}
		var d2 = div*2+1 ;
		for(var j = 0 ; j < div ; ++j) {
			var base = j * d2;
			for(var i = 0 ; i < div*2 ; ++i) {
				if(ninv>0) s.push(
					[base + i,	  base + i + 1, base + i     + d2],
					[base + i + d2, base + i + 1, base + i + 1 + d2]);
				else s.push(
					[base + i     + d2,	base + i + 1, base + i],
					[base + i + 1 + d2, base + i + 1, base + i + d2 ]);

			}
		}
		break;
	case "cylinder":
		for(var i = 0 ; i < div ; ++i) {
			var v = i / (0.0+div);
			var z = Math.cos(PHI * v)*wz, x = Math.sin(PHI * v)*wx;
			p.push([x,wy,z])
			n.push([x*ninv,0,z*ninv])
			t.push([v,1])
			p.push([x,-wy,z])
			n.push([x*ninv,0,z*ninv,0])
			t.push([v,0])			
		}
		for(var j =0; j < div-1 ;j++) {
			if(ninv<0)s.push([j*2,j*2+2,j*2+3,j*2+1]) ;
			else s.push([j*2,j*2+1,j*2+3,j*2+2]) ;
		}
		if(ninv<0) s.push([j*2,0,1,j*2+1])
		else s.push([j*2,j*2+1,1,0])
		break; 
	case "cone":
		for(var i = 0 ; i < div ; ++i) {
			var v = i / (0.0+div);
			var z = Math.cos(PHI * v)*wz, x = Math.sin(PHI * v)*wx;
			p.push([0,wy,0])
			n.push([x*ninv,0,z*ninv])
			t.push([v,1])
			p.push([x,-wy,z])
			n.push([x*ninv,0,z*ninv,0])
			t.push([v,0])			
		}
		for(var j =0; j < div-1 ;j++) {
			if(ninv<0)s.push([j*2,j*2+2,j*2+3,j*2+1]) ;
			else s.push([j*2,j*2+1,j*2+3,j*2+2]) ;
		}
		if(ninv<0) s.push([j*2,0,1,j*2+1])
		else s.push([j*2,j*2+1,1,0])
		break; 
	case "disc":
		for(var i = 0 ; i < div ; ++i) {
			var v = i / (0.0+div);
			var z = Math.cos(PHI * v)*wz, x = Math.sin(PHI * v)*wx;
			p.push([x,0,z])
			n.push([0,1,0])
			t.push([v,1])	
		}
		p.push([0,0,0])
		n.push([0,1,0])
		t.push([0,0])
		for(var j =0; j < div-1 ;j++) {
			s.push([j,j+1,div]) ;
		}
		s.push([j,0,div])
		break; 
	case "plane":
		p = [[wx,0,wz],[wx,0,-wz],[-wx,0,-wz],[-wx,0,wz]]
		n = [[0,1,0],[0,1,0],[0,1,0],[0,1,0]]
		t = [[1,1],[1,0],[0,0],[0,1]]
		s = [[0,1,2],[2,3,0]]
		break ;
	case "box":
		p = [
			[wx,wy,wz],[wx,-wy,wz],[-wx,-wy,wz],[-wx,wy,wz],
			[wx,wy,-wz],[wx,-wy,-wz],[-wx,-wy,-wz],[-wx,wy,-wz],
			[wx,wy,wz],[wx,-wy,wz],[wx,-wy,-wz],[wx,wy,-wz],
			[-wx,wy,wz],[-wx,-wy,wz],[-wx,-wy,-wz],[-wx,wy,-wz],
			[wx,wy,wz],[wx,wy,-wz],[-wx,wy,-wz],[-wx,wy,wz],
			[wx,-wy,wz],[wx,-wy,-wz],[-wx,-wy,-wz],[-wx,-wy,wz],
		]
		n = [
			[0,0,ninv],[0,0,ninv],[0,0,ninv],[0,0,ninv],
			[0,0,-ninv],[0,0,-ninv],[0,0,-ninv],[0,0,-ninv],
			[ninv,0,0],[ninv,0,0],[ninv,0,0],[ninv,0,0],
			[-ninv,0,0],[-ninv,0,0],[-ninv,0,0],[-ninv,0,0],
			[0,ninv,0],[0,ninv,0],[0,ninv,0],[0,ninv,0],
			[0,-ninv,0],[0,-ninv,0],[0,-ninv,0],[0,-ninv,0]
		]
		t = [
			[1,1],[1,0],[0,0],[0,1],
			[0,1],[0,0],[1,0],[1,1],
			[0,1],[0,0],[1,0],[1,1],
			[1,1],[1,0],[0,0],[0,1],
			[1,0],[1,1],[0,1],[0,0],
			[1,1],[1,0],[0,0],[0,1]
		]
		s = (ninv>0)?[
			[3,1,0],[2,1,3],
			[4,5,7],[7,5,6],
			[8,9,11],[11,9,10],
			[15,13,12],[14,13,15],	
			[16,17,19],[19,17,18],
			[23,21,20],[22,21,23],		
		]:[
			[0,1,3],[3,1,2],
			[7,5,4],[6,5,7],
			[11,9,8],[10,9,11],
			[12,13,15],[15,13,14],	
			[19,17,16],[18,17,19],
			[20,21,23],[23,21,22],		
		]
		break ;
	case "mesh":
		
		break ;
	case "torus":
		this.parametricModel( function(u,v) {
			var R = 1.0 ;
			var sr = (param.sr)?param.sr:0.5 ;
			var du = u ;
			var dv = -v ;
			var cx = Math.sin(du*PHI) ;
			var cz = Math.cos(du*PHI) ;
			var vx = Math.sin(dv*PHI) ;
			var vy = Math.cos(dv*PHI) ;
			var tx = 1
			var mx = sr*vx*cx ;
			var mz = sr*vx*cz ;
			var my = sr*vy ;
			var ml = Math.sqrt(mx*mx+my*my+mz*mz) ;
	
			var px = R*cx + tx*mx ;
			var pz = R*cz + tx*mz ;
			var py = tx*my ;
			var r = {
				px:px*wx, py:py*wy, pz:pz*wz,
				nx:0, ny:0, nz:0,
				mu:u, mv:v }
			return r ;			
			
		},{start:0,end:1.0,div:div*2},{start:0,end:1,div:div}) ;
		return this ;
	}	
	this.obj_v = p 
	this.obj_n = n
	this.obj_t = t
	this.obj_i = s
//	console.log(p)
//	console.log(n)
//	console.log(t)
//	console.log(s)
	return this ;
}
// generate parametric model by function
WWModel.prototype.parametricModel =function(func,pu,pv,opt) {
	pos = [] ;
	norm = [] ;
	uv = [] ;
	indices = [] ;

	var du = (pu.end - pu.start)/pu.div ;
	var dv = (pv.end - pv.start)/pv.div ;
	for(var iu =0; iu <= pu.div ;iu++ ) {
		for(var iv = 0 ;iv<= pv.div; iv++ ) {
			var u = pu.start+du*iu ;
			var v = pv.start+dv*iv ;
			var p = func(u,v) ;
			pos.push( [p.px,p.py,p.pz] ) ;
			if(p.mu!=undefined) uv.push([p.mu,p.mv]) ;
			// calc normal
			if(p.nx==0&&p.ny==0&&p.nz==0) {
				var dud = du/10 ; var dvd = dv/10 ;
				var du0 = func(u-dud,v) ; var du1 = func(u+dud,v) ;
				var nux = (du1.px - du0.px)/(dud*2) ;
				var nuy = (du1.py - du0.py)/(dud*2) ;
				var nuz = (du1.pz - du0.pz)/(dud*2) ;
				var dv0 = func(u,v-dvd) ; var dv1 = func(u,v+dvd) ;
				var nvx = (dv1.px - dv0.px)/(dvd*2) ;
				var nvy = (dv1.py - dv0.py)/(dvd*2) ;
				var nvz = (dv1.pz - dv0.pz)/(dvd*2) ;
				var nx = nuy*nvz - nuz*nvy ;
				var ny = nuz*nvx - nux*nvz ;
				var nz = nux*nvy - nuy*nvx ;
				var nl = Math.sqrt(nx*nx+ny*ny+nz*nz); 
				p.nx = nx/nl ;
				p.ny = ny/nl ;
				p.nz = nz/nl ;
			}
			norm.push([p.nx, p.ny,p.nz] ) ;
		}
	}
	var d2 = pv.div+1 ;
	for(var j = 0 ; j < pu.div ; ++j) {
		var base = j * d2;
		for(var i = 0 ; i < pv.div ; ++i) {
			indices.push([base+i,base+i+d2,base+i+d2+1,base+i+1])	
		}	

	}
	this.obj_v = pos
	this.obj_n = norm
	if(uv.length>0) this.obj_t = uv
	this.obj_i = indices 
	return this ;
}

// other utils 
WWModel.HSV2RGB = function( H, S, V ) {
	var ih;
	var fl;
	var m, n;
	var rr,gg,bb ;
	H = H * 6 ;
	ih = Math.floor( H );
	fl = H - ih;
	if( !(ih & 1)) fl = 1 - fl;
	m = V * ( 1 - S );
	n = V * ( 1 - S * fl );
	switch( ih ){
		case 0:
		case 6:
			rr = V; gg = n; bb = m; break;
		case 1: rr = n; gg = V; bb = m; break;
		case 2: rr = m; gg = V; bb = n; break;
		case 3: rr = m; gg = n; bb = V; break;
		case 4: rr = n; gg = m; bb = V; break;
		case 5: rr = V; gg = m; bb = n; break;
	}
	return [rr,gg,bb,1.0] ;
}
WWModel.snormal = function(pa) {
	var yx = pa[1][0]-pa[0][0];
	var yy = pa[1][1]-pa[0][1];
	var yz = pa[1][2]-pa[0][2];
	var zx = pa[2][0]-pa[0][0];
	var zy = pa[2][1]-pa[0][1];
	var zz = pa[2][2]-pa[0][2];				
	var xx =  yy * zz - yz * zy;
	var xy = -yx * zz + yz * zx;
	var xz =  yx * zy - yy * zx;
	var vn = Math.sqrt(xx*xx+xy*xy+xz*xz) ;
	xx /= vn ; xy /= vn ; xz /= vn ;
	return [xx,xy,xz] ;
}