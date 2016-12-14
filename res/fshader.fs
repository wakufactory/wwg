#pragma inlucde(mylib.fs)

	uniform mat4 mvpMatrix;
	uniform mat4 normalMatrix;
	uniform vec4 lightVec;
	uniform int vmode ;
	uniform vec3 vofs ;
	uniform float vmag ;

	attribute vec3 position;
	attribute vec3 normal;
	attribute vec2 uv;
	attribute vec4 vcolor ;
	attribute vec3 mmod ;

	varying vec4 pcolor;
	varying vec2 texCoord;
	varying float light ;
	varying vec3 norm;

	void main() {
		vec3	n	 = (normalMatrix * vec4(normal, 0.0)).xyz;
		light = clamp(dot(n, lightVec.xyz), 0.0, 1.0) * 0.7 + 0.3;
		if(vmode==2) {
			pcolor = vec4(light, light, light, 1.0)* vcolor;
		} else if(vmode==5) {
			pcolor = vcolor;
		} else if(vmode==1) {
			pcolor = vec4(1.0,1.0,1.0,1.0) ;
		} else {
			pcolor = vec4(light, light, light, 1.0) ;
		}
		texCoord	= vec2(uv.x,-uv.y);
//		texCoord = vec2(position.x,-position.y) ;
		vec3 pos = position + mmod.xyz * vofs ;

		gl_Position = mvpMatrix * vec4(pos, 1.0) ;
		norm = n ;
		gl_PointSize = 2.0 ;
	}

