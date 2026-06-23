// Page script moved from index.html inline <script>
// This file expects THREE to be available globally (from CDN in index.html).

let gltfLoader = null;
if (typeof THREE !== 'undefined' && THREE.GLTFLoader) {
    gltfLoader = new THREE.GLTFLoader();
}

//models data
const dundunData = [
    { id: 1, isCustom: true, url: '/models/dundun1.glb', name: 'DunDun 1' },
    { id: 2, isCustom: true, url: '/models/dundun2.glb', name: 'DunDun 2' },
    { id: 3, isCustom: true, url: '/models/dundun3.glb', name: 'DunDun 3' },
    { id: 4, isCustom: true, url: '/models/dundun4.glb', name: 'DunDun 4' },
    { id: 5, isCustom: true, url: '/models/dundun5.glb', name: 'DunDun 5' },
    { id: 6, isCustom: true, url: '/models/dundun6.glb', name: 'DunDun 6' }
];

//texture
const createSketchTexture = (type) => {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#000000'; ctx.strokeStyle = '#000000';

    if (type === 'sketch-dots') {
        for(let i=0; i<10; i++) for(let j=0; j<10; j++) { ctx.beginPath(); ctx.arc(12 + i*25, 12 + j*25, 6, 0, Math.PI*2); ctx.fill(); }
    } else if (type === 'sketch-stripes') {
        ctx.lineWidth = 10; for(let i=0; i<15; i++) { ctx.beginPath(); ctx.moveTo(0, i*30); ctx.lineTo(256, i*30 + 100); ctx.stroke(); }
    } else if (type === 'sketch-grid') {
        ctx.lineWidth = 4; for(let i=0; i<=256; i+=32) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke(); }
    } else if (type === 'sketch-noise') {
        for(let i=0; i<500; i++) ctx.fillRect(Math.random()*256, Math.random()*256, 3, 3);
        ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(50,50); ctx.lineTo(200,200); ctx.stroke(); ctx.beginPath(); ctx.moveTo(200,50); ctx.lineTo(50,200); ctx.stroke();
    } else if (type === 'sketch-lines') {
        ctx.lineWidth = 2; for(let i=0; i<256; i+=8) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke(); }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    return texture;
};

class DunDunRenderer {
    constructor(container, data, isInteractive = false) {
        this.container = container; this.data = data; this.isInteractive = isInteractive;
        this.width = container.clientWidth; this.height = container.clientHeight;
        this.init();
    }
    init() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 100);
        this.camera.position.z = this.isInteractive ? 2.2 : 2.5;
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        // more natural rendering settings (brighter default)
        if (THREE.ColorManagement !== undefined) {
            try { this.renderer.outputEncoding = THREE.sRGBEncoding; } catch (e) {}
        } else {
            try { this.renderer.outputEncoding = THREE.sRGBEncoding; } catch (e) {}
        }
        try {
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 1.4; // brighter exposure
            this.renderer.physicallyCorrectLights = true;
        } catch (e) {}

        this.container.appendChild(this.renderer.domElement);
        // allow pointer events so users can hover to rotate
        this.renderer.domElement.style.display = 'block';
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';

        // hover interaction state
        this.isHovered = false;
        this.baseRotation = { x: 0, y: 0 };
        this.targetRotation = { x: 0, y: 0 };
        this.maxYaw = 1.2; // how far horizontally the model can rotate from center
        this.maxPitch = 0.6; // how far vertically
        // auto-rotation settings (when not hovered)
        this.autoRotateSpeedY = 0.006; // radians per frame-ish
        this.autoOscillationAmp = 0.02; // small X oscillation amplitude
        this._autoTimeOffset = Math.random() * 10000; // desync oscillations between items

        // attach pointer listeners to enable hover-driven rotation
        this.renderer.domElement.addEventListener('mouseenter', (e) => {
            this.isHovered = true;
            if (this.model) {
                this.baseRotation.x = this.model.rotation.x;
                this.baseRotation.y = this.model.rotation.y;
                this.targetRotation.x = this.baseRotation.x;
                this.targetRotation.y = this.baseRotation.y;
            }
        });

        this.renderer.domElement.addEventListener('mousemove', (e) => {
            if (!this.isHovered) return;
            const rect = this.renderer.domElement.getBoundingClientRect();
            const nx = (e.clientX - rect.left) / rect.width; // 0..1
            const ny = (e.clientY - rect.top) / rect.height; // 0..1
            const yaw = (nx - 0.5) * 2 * this.maxYaw; // -max..max
            const pitch = (ny - 0.5) * 2 * this.maxPitch; // -max..max
            this.targetRotation.y = this.baseRotation.y + yaw;
            this.targetRotation.x = this.baseRotation.x + pitch;
        });

        this.renderer.domElement.addEventListener('mouseleave', (e) => {
            this.isHovered = false;
            // on leave, return to base rotation
            this.targetRotation.x = this.baseRotation.x;
            this.targetRotation.y = this.baseRotation.y;
        });
        
    // Natural lighting: hemisphere + soft directional + subtle fill + rim
    const hemi = new THREE.HemisphereLight(0xffffff, 0x666666, 0.9);
    hemi.position.set(0, 20, 0);
    this.scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xffffff, 1.4);
    dir.position.set(3, 8, 6);
    dir.castShadow = false;
    // soften by lowering intensity and slightly warming
    dir.color = new THREE.Color(0xffffff).multiplyScalar(1.0);
    this.scene.add(dir);

    const fill = new THREE.DirectionalLight(0xffffff, 0.6);
    fill.position.set(-5, 2, -3);
    this.scene.add(fill);

    // small rim light to lift silhouettes
    const rim = new THREE.PointLight(0xffffff, 0.45);
    rim.position.set(0, 4, -6);
    this.scene.add(rim);

    // subtle ambient for base brightness
    const ambient = new THREE.AmbientLight(0xffffff, 0.25);
    this.scene.add(ambient);
        
        this.createObject();
        this.animate = this.animate.bind(this);
        this.animate();
    }
    createObject() {
        if (this.data.isCustom && this.data.url) {
            if (!gltfLoader) gltfLoader = new THREE.GLTFLoader();
            gltfLoader.load(this.data.url, (gltf) => {
                this.model = gltf.scene;
                const box = new THREE.Box3().setFromObject(this.model);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());
                this.model.position.sub(center);
                const maxDim = Math.max(size.x, size.y, size.z);
                const scaleFactor = maxDim > 0 ? (1.2 / maxDim) : 1;
                this.model.scale.set(scaleFactor, scaleFactor, scaleFactor);
                this.scene.add(this.model);
                // initialize baseRotation from the loaded model rotation
                this.baseRotation.x = this.model.rotation.x || 0;
                this.baseRotation.y = this.model.rotation.y || 0;
                this.targetRotation.x = this.baseRotation.x;
                this.targetRotation.y = this.baseRotation.y;
            }, undefined, (e) => this.createBox('sketch-noise'));
        } else {
            this.createBox(this.data.type);
        }
    }
    createBox(type) {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial({ 
            map: createSketchTexture(type), color: 0xffffff,
            polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
        });
        this.mesh = new THREE.Mesh(geometry, material);
        const edges = new THREE.EdgesGeometry(geometry);
        const wireframe = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 }));
        this.mesh.add(wireframe);
        if(!this.data.isCustom) this.mesh.scale.set(1.1, 1, 1.1);
        this.scene.add(this.mesh);
        this.model = this.mesh;
    }
    animate() {
        requestAnimationFrame(this.animate);
        if (this.model) {
            // If hovered, interpolate smoothly toward targetRotation computed from mouse
            if (this.isHovered) {
                // smooth follow
                this.model.rotation.x += (this.targetRotation.x - this.model.rotation.x) * 0.15;
                this.model.rotation.y += (this.targetRotation.y - this.model.rotation.y) * 0.15;
            } else {
                // not hovered: auto-rotate around Y and apply gentle X oscillation for custom models
                if (this.data.isCustom) {
                    // advance the base rotation slowly
                    this.baseRotation.y += this.autoRotateSpeedY;
                    const t = (Date.now() + this._autoTimeOffset) * 0.001;
                    this.baseRotation.x = Math.sin(t) * this.autoOscillationAmp;
                    // lerp current rotation towards updated baseRotation
                    this.model.rotation.x += (this.baseRotation.x - this.model.rotation.x) * 0.08;
                    this.model.rotation.y += (this.baseRotation.y - this.model.rotation.y) * 0.08;
                } else {
                    // keep the previous subtle auto-rotation for procedural boxes
                    this.model.rotation.y += 0.005;
                    this.model.rotation.x = Math.sin(Date.now() * 0.001) * 0.1;
                }
            }
        }
        this.renderer.render(this.scene, this.camera);
    }
    resize() {
        this.width = this.container.clientWidth; this.height = this.container.clientHeight;
        if(this.width === 0) return;
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.width, this.height);
    }
    dispose() {
        this.container.innerHTML = '';
    }
}

const gridContainer = document.getElementById('grid-container');
const dropZone = document.getElementById('drop-zone');
const dropText = document.getElementById('drop-text');
const adoptedContainer = document.getElementById('adopted-container');
const btnAdopt = document.getElementById('btn-adopt');
const btnReset = document.getElementById('btn-reset');
const modal = document.getElementById('modal');
let currentAdoptedRenderer = null;
let selectedDunDunData = null;
const renderers = [];

function renderGrid() {
    gridContainer.innerHTML = '';
    renderers.length = 0;
    dundunData.forEach(data => {
        const cell = document.createElement('div');
        cell.className = 'dundun-item';
        cell.draggable = true;
    const canvasContainer = document.createElement('div');
    canvasContainer.style.width = '100%'; canvasContainer.style.height = '100%'; canvasContainer.style.pointerEvents = 'auto';
        cell.appendChild(canvasContainer);
        gridContainer.appendChild(cell);
        setTimeout(() => renderers.push(new DunDunRenderer(canvasContainer, data)), 0);
        cell.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('application/json', JSON.stringify(data));
        });
        // also allow starting drag from the canvas area (child element)
        canvasContainer.draggable = true;
        canvasContainer.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('application/json', JSON.stringify(data));
        });
    });
}

dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault(); dropZone.classList.remove('drag-over');
    try {
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        if(currentAdoptedRenderer) currentAdoptedRenderer.dispose();
        selectedDunDunData = data;
        dropText.style.display = 'none';
        adoptedContainer.style.display = 'block';
        dropZone.classList.add('has-content');
        btnAdopt.disabled = false;
        setTimeout(() => {
            currentAdoptedRenderer = new DunDunRenderer(adoptedContainer, data, true);
            currentAdoptedRenderer.resize();
        },0);
    } catch(err){}
});

btnReset.addEventListener('click', () => {
    if(currentAdoptedRenderer) { currentAdoptedRenderer.dispose(); currentAdoptedRenderer = null; }
    selectedDunDunData = null;
    dropText.style.display = 'block'; adoptedContainer.style.display = 'none'; dropZone.classList.remove('has-content');
    btnAdopt.disabled = true;
});
    
btnAdopt.addEventListener('click', () => { if(selectedDunDunData) modal.classList.remove('hidden'); });
window.closeModal = () => modal.classList.add('hidden');
window.addEventListener('resize', () => { renderers.forEach(r => r.resize()); if(currentAdoptedRenderer) currentAdoptedRenderer.resize(); });
    
// form
function handleAdoptionSubmit(event) {
    event.preventDefault();
    // 提交成功后替换弹窗内容，同样使用立方体图标
    const modalContent = document.getElementById('modal-content');
    modalContent.innerHTML = `
        <svg class="cube-icon" viewBox="0 0 100 100" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M25 25 L75 25 L75 75 L25 75 Z" fill="white"/>
            <path d="M25 25 L40 10 L90 10 L75 25" />
            <path d="M90 10 L90 60 L75 75" />
        </svg>
        <h2 style="font-size: 4vh; text-transform: uppercase; margin: 1vh 0; border-bottom: var(--line-width) solid black; padding-bottom: 1vh;">Request Sent!</h2>
        <p style="font-size: 2vh; font-weight: bold; line-height: 1.4; margin-bottom: 2vh;">
            DunDun is packing luggage.<br>We will contact you soon.
        </p>
        <button class="brutalist-btn" onclick="closeModal()">Close</button>
    `;
}

// Expose the form handler in global scope for inline onsubmit attribute
window.handleAdoptionSubmit = handleAdoptionSubmit;

renderGrid();
