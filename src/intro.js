import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Configuration
const CUBE_COUNT = 6;
const CUBE_SIZE = 6; // Uniform size for all models
const VERTICAL_SPACING = 25; // Distance to simulate full page height
const STAGGER_OFFSET = 5.0; // Extreme horizontal offset

// Setup Scene
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);
// Add some fog for depth
scene.fog = new THREE.Fog(0xffffff, 10, 60);

// Setup Camera
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
// Initial position
camera.position.set(0, 2, 25);

// Setup Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5); // Increased intensity
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 2.0); // Increased intensity
dirLight.position.set(5, 10, 7);
dirLight.castShadow = true;
scene.add(dirLight);

// Add a fill light from the other side
const fillLight = new THREE.DirectionalLight(0xffffff, 1.0);
fillLight.position.set(-5, 0, 5);
scene.add(fillLight);

// Create Models (Stacked like blocks)
const cubes = []; // Keeping variable name for compatibility
const loader = new GLTFLoader();

for (let i = 0; i < CUBE_COUNT; i++) {
    const modelIndex = (i % 6) + 1; // Cycle through 1-6 if count > 6
    
    loader.load(`./models/dundun${modelIndex}.glb`, (gltf) => {
        const model = gltf.scene;
        
        // Position logic: Staggered stack
        // Y goes down
        // Shift up by one VERTICAL_SPACING so the first model (i=0) is above, and i=1 is at 0
        const y = -(i - -0.5) * VERTICAL_SPACING;
        
        // X and Z stagger. Left/Right alternating
        // Even: Left (-), Odd: Right (+)
        const x = (i % 2 === 0) ? -STAGGER_OFFSET : STAGGER_OFFSET;
        const z = 0;

        model.position.set(x, y, z);
        
        // Scale the model to match the previous cube size roughly
        model.scale.set(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);

        // Slight tilt
        model.rotation.x = 0.1;
        model.rotation.z = 0.3;

        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        scene.add(model);
        cubes[i] = model; // Store in array for animation
    }, undefined, (error) => {
        console.error('An error occurred loading the model:', error);
    });
}

// Images are now handled in HTML
// Scroll Interaction
function updateCamera() {
    const scrollY = window.scrollY;
    const maxScroll = document.body.scrollHeight - window.innerHeight;
    const scrollFraction = Math.max(0, Math.min(1, scrollY / maxScroll));

    // Current float index in the stack (0 to CUBE_COUNT) - allow scrolling past last model
    const scrollIndex = scrollFraction * CUBE_COUNT;

    // Calculate Target Focus Point
    // Y: Interpolate between cube Y positions
    const targetY = -scrollIndex * VERTICAL_SPACING;
    
    // X: Oscillate between Left (-STAGGER_OFFSET) and Right (+STAGGER_OFFSET)
    // Using Cosine to match: 0 -> Left (-), 1 -> Right (+)
    // cos(0) = 1 => -1 * 1 = -1 (Left)
    // cos(pi) = -1 => -1 * -1 = +1 (Right)
    const targetX = -STAGGER_OFFSET * Math.cos(scrollIndex * Math.PI);
    
    const targetZ = 0;

    // Camera Position
    // We want constant distance to the target
    const cameraDistance = 15;
    
    // Camera stays centered on X axis (x=0) to get the "turn" effect
    const camX = 0;
    
    // Camera Y follows target Y, slightly above to look down
    const camYOffset = 2;
    const camY = targetY + camYOffset; 

    // Calculate Cam Z to maintain distance
    // dist^2 = (camX - targetX)^2 + (camY - targetY)^2 + (camZ - targetZ)^2
    // We fix camX=0, camY relative to targetY is fixed (offset).
    // dist^2 = (-targetX)^2 + (offset)^2 + camZ^2
    // camZ^2 = dist^2 - targetX^2 - offset^2
    
    const distSq = cameraDistance * cameraDistance;
    const xSq = targetX * targetX;
    const yOffsetSq = camYOffset * camYOffset;
    
    // Ensure we don't take sqrt of negative
    let camZ = Math.sqrt(Math.max(1, distSq - xSq - yOffsetSq));

    camera.position.set(camX, camY, camZ);
    camera.lookAt(targetX, targetY, targetZ);
}

// Animation Loop
function animate() {
    requestAnimationFrame(animate);
    
    // Optional: Rotate cubes slightly for life
    cubes.forEach((cube, i) => {
        if (cube) {
            cube.rotation.y += 0.007;
        }
    });

    renderer.render(scene, camera);
}

// Handle Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Handle Scroll
window.addEventListener('scroll', updateCamera);

// Initial call
updateCamera();
animate();
