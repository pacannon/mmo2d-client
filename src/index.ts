import * as THREE from 'three';

var camera: THREE.Camera, scene: THREE.Scene, renderer: THREE.Renderer;
var geometry, material, mesh: THREE.Mesh;
var geometry2, material2, mesh2;

init();
animate();

function init() {

	camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 10 );
	camera.rotation.x = Math.PI/2;
	camera.position.y = -2.3;
	camera.position.z = 1;

	scene = new THREE.Scene();

	geometry = new THREE.BoxGeometry( 0.2, 0.2, 0.2 );
	material = new THREE.MeshNormalMaterial();

	mesh = new THREE.Mesh( geometry, material );
	scene.add( mesh );

	geometry2 = new THREE.PlaneGeometry( 1, 1 );
	material2 = new THREE.MeshNormalMaterial();
	
	mesh2 = new THREE.Mesh( geometry2, material2 );
	scene.add( mesh2 );

	renderer = new THREE.WebGLRenderer( { antialias: true } );
	renderer.setSize( window.innerWidth, window.innerHeight );
	document.body.appendChild( renderer.domElement );
	
}

function animate() {

	requestAnimationFrame( animate );

	mesh.rotation.x += 0.01;
	mesh.rotation.y += 0.02;

	renderer.render( scene, camera );

}