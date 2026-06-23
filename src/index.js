import "./style.css";
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Raycaster } from 'three';

// Create scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff); // Matching your desired background color

// Create camera with fixed position
const camera = new THREE.PerspectiveCamera(
    32, // 视野角度
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
// 相机位置：直接正对网格中心
camera.position.set(0, 0, 5); // (x, y, z) - 直接在网格正前方

// Create renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.outputEncoding = THREE.sRGBEncoding; // Better color handling
renderer.toneMapping = THREE.ACESFilmicToneMapping; // Better light handling
renderer.toneMappingExposure = 1.2; // Slightly brighter exposure
document.body.appendChild(renderer.domElement);

// Add lights
// Ambient light for overall illumination
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); // Increased intensity
scene.add(ambientLight);

// Main directional light (like sunlight)
const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
mainLight.position.set(5, 10, 7);
scene.add(mainLight);

// Add a secondary directional light from the opposite side
const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
fillLight.position.set(-5, 3, -5);
scene.add(fillLight);

// Add a hemisphere light for more natural ambient lighting
const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.6);
hemiLight.position.set(0, 20, 0);
scene.add(hemiLight);

// Add OrbitControls but disable all interactions
const controls = new OrbitControls(camera, renderer.domElement);

// 禁用所有相机控制
controls.enablePan = false;     // 禁止平移
controls.enableZoom = false;    // 禁止缩放
controls.enableRotate = false;  // 禁止旋转

// 设置相机朝向（通过controls.target控制）
// 注意：要调整相机看向哪里，修改这里的 target，而不是 camera.lookAt
controls.target.set(0, 0, 0);  // 相机看向的目标点 (x, y, z)
controls.update();

// Load 3D Model
const loader = new GLTFLoader();

console.log('Starting to load model...');

// 保存所有模型和中心点
const models = [];
const modelCenters = [];

// 记录当前悬停和拖动的模型索引
let hoveredModelIndex = -1;
let draggingModelIndex = -1;
let lastMouseX = 0;
let lastMouseY = 0;

// 右侧选择框相关变量
let selectedModel = null;  // 当前在右侧框中的模型
let modelOriginalPositions = [];  // 存储模型的原始位置
let modelOriginalScales = [];     // 存储模型的原始缩放
let modelPreDragPositions = [];   // 存储拖动前的位置
let modelPreDragScales = [];      // 存储拖动前的缩放

// 悬停旋转相关变量
let modelRotationAngles = [];  // 存储模型的初始旋转角度
let modelHoverRotations = [];  // 记录悬停时的旋转速度

// ========== 可调整的布局参数 ==========
const COLS = 3;              // 列数
const ROWS = 3;              // 行数
const GRID_SPACING_X = 1.0;  // 水平间距（可调整）
const GRID_SPACING_Y = 1.0;  // 垂直间距（可调整）
const GRID_OFFSET_X = -2.2;  // 网格整体X位置（负数=左边，正数=右边）
const GRID_OFFSET_Y = 1.0;   // 网格整体Y位置（正数=上，负数=下）

// 右侧选择框参数
const RIGHT_BOX_X = 1.7;      // 右侧框的X位置
const RIGHT_BOX_Y = 0.5;        // 右侧框的Y位置
const RIGHT_BOX_WIDTH = 1;  // 右侧框宽度（可调整）
const RIGHT_BOX_HEIGHT = 1; // 右侧框高度（可调整）
const RIGHT_BOX_Z = -0.3;     // 右侧框深度

// 每列模型的独立X轴偏移（可调整每列的左右位置）
const COLUMN_X_OFFSET = [
    0.1,      // 左列的X偏移（第一列）
    0.1,      // 中列的X偏移（第二列）- 可以修改这个值
    0       // 右列的X偏移（第三列）- 可以修改这个值
];

// 每列模型的独立Y轴偏移（可调整每列的上下位置）
const COLUMN_Y_OFFSET = [
    0,      // 左列的Y偏移（第一列）
    -0.3,   // 中列的Y偏移（第二列）- 可以修改这个值
    -0.3    // 右列的Y偏移（第三列）- 可以修改这个值
];

const FRAME_WIDTH = 0.95;     // 边框宽度（可调整）
const FRAME_HEIGHT = 0.95;    // 边框高度（可调整）
const FRAME_Z = -0.3;        // 边框距离模型的深度

const MODEL_SCALE = 0.25;    // 模型正常大小（可调整）
const MODEL_HOVER_SCALE = 0.35; // 模型悬停大小（可调整）
// ======================================

// 生成9个模型的位置数据（3x3网格）
const modelData = [];
for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
        modelData.push({
            position: {
                x: GRID_OFFSET_X + col * GRID_SPACING_X + COLUMN_X_OFFSET[col],
                y: GRID_OFFSET_Y - row * GRID_SPACING_Y + COLUMN_Y_OFFSET[col],
                z: 0
            },
            scale: 0.55,
            targetScale: 0.55,  // 初始目标大小改为正常大小
            modelIndex: col  // 0=dundun1, 1=dundun2, 2=dundun3
        });
    }
}

const NORMAL_SCALE = 0.55;
const HOVER_SCALE = 0.85;

// 生成9个边框位置（边框保持网格对齐，不受模型Y偏移影响）
const framePositions = [];
for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
        framePositions.push({
            x: GRID_OFFSET_X + col * GRID_SPACING_X,
            y: GRID_OFFSET_Y - row * GRID_SPACING_Y,  // 边框不加偏移
            z: FRAME_Z
        });
    }
}

// 创建边框的函数（只有描边，中间透明）
function createFrame(framePos) {
    const frame = new THREE.Group();
    
    // 创建线框材质
    const lineMaterial = new THREE.LineBasicMaterial({ 
        color: 0x000000,
        linewidth: 2  // 注意：linewidth在大多数平台上只支持1
    });
    
    // 创建矩形的四条边
    const points = [];
    points.push(new THREE.Vector3(-FRAME_WIDTH/2, -FRAME_HEIGHT/2, 0));
    points.push(new THREE.Vector3(FRAME_WIDTH/2, -FRAME_HEIGHT/2, 0));
    points.push(new THREE.Vector3(FRAME_WIDTH/2, FRAME_HEIGHT/2, 0));
    points.push(new THREE.Vector3(-FRAME_WIDTH/2, FRAME_HEIGHT/2, 0));
    points.push(new THREE.Vector3(-FRAME_WIDTH/2, -FRAME_HEIGHT/2, 0)); // 闭合
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, lineMaterial);
    
    frame.add(line);
    frame.position.set(framePos.x, framePos.y, framePos.z);
    
    return frame;
}

// 创建右侧选择框的函数
function createRightSelectionBox() {
    const box = new THREE.Group();
    
    // 创建线框材质
    const lineMaterial = new THREE.LineBasicMaterial({ 
        color: 0x000000,
        linewidth: 2
    });
    
    // 创建矩形的四条边
    const points = [];
    points.push(new THREE.Vector3(-RIGHT_BOX_WIDTH/2, -RIGHT_BOX_HEIGHT/2, 0));
    points.push(new THREE.Vector3(RIGHT_BOX_WIDTH/2, -RIGHT_BOX_HEIGHT/2, 0));
    points.push(new THREE.Vector3(RIGHT_BOX_WIDTH/2, RIGHT_BOX_HEIGHT/2, 0));
    points.push(new THREE.Vector3(-RIGHT_BOX_WIDTH/2, RIGHT_BOX_HEIGHT/2, 0));
    points.push(new THREE.Vector3(-RIGHT_BOX_WIDTH/2, -RIGHT_BOX_HEIGHT/2, 0)); // 闭合
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, lineMaterial);
    
    box.add(line);
    box.position.set(RIGHT_BOX_X, RIGHT_BOX_Y, RIGHT_BOX_Z);
    box.userData.isSelectionBox = true;  // 标记为选择框
    
    return box;
}

// 创建右侧选择框
const rightSelectionBox = createRightSelectionBox();
// scene.add(rightSelectionBox); // 移除右侧选择框的显示

// 模型文件和初始旋转角度
const modelFiles = [
    { path: '/models/dundun1.glb', rotation: 0.5 },
    { path: '/models/dundun2.glb', rotation: -0.5 },
    { path: '/models/dundun3.glb', rotation: 2.5 }
];

// 加载所有9个模型（3x3网格）
modelData.forEach((data, index) => {
    const modelInfo = modelFiles[data.modelIndex];
    
    loader.load(
        modelInfo.path,
        function (gltf) {
            const model = gltf.scene.clone();
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            
            model.scale.set(data.scale, data.scale, data.scale);
            model.position.set(data.position.x, data.position.y, data.position.z);
            model.rotation.y = modelInfo.rotation;
            model.userData.index = index;
            
            // 保存原始位置和缩放
            modelOriginalPositions[index] = {
                x: data.position.x,
                y: data.position.y,
                z: data.position.z
            };
            modelOriginalScales[index] = data.scale;
            
            // 保存初始旋转角度
            modelRotationAngles[index] = modelInfo.rotation;
            modelHoverRotations[index] = 0;  // 初始没有额外旋转
            
            // 初始化拖动前位置（初始时与原始位置相同）
            modelPreDragPositions[index] = {
                x: data.position.x,
                y: data.position.y,
                z: data.position.z
            };
            modelPreDragScales[index] = data.scale;
            
            // 添加边框 - 已移除
            // const frame = createFrame(framePositions[index]);
            // scene.add(frame);
            
            scene.add(model);
            models.push(model);
            modelCenters.push(center);
        }
    );
});

// 鼠标拾取检测
const raycaster = new Raycaster();
const mouse = new THREE.Vector2();

function getIntersectedModelIndex(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    for (let i = 0; i < models.length; i++) {
        const intersects = raycaster.intersectObject(models[i], true);
        if (intersects.length > 0) {
            return i;
        }
    }
    return -1;
}

// 检查鼠标是否在右侧选择框内
function isMouseInRightBox(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // 将屏幕坐标转换为NDC坐标再到世界坐标
    const ndcX = (mouseX / window.innerWidth) * 2 - 1;
    const ndcY = -(mouseY / window.innerHeight) * 2 + 1;
    
    // 创建射线
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    
    // 检查是否与右侧框相交
    const intersects = raycaster.intersectObject(rightSelectionBox, true);
    return intersects.length > 0;
}

// 将屏幕坐标转换为 3D 世界坐标（在相机前方的平面上）
function getWorldCoordinateFromMouse(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // 将屏幕坐标转换为NDC坐标
    const ndcX = (mouseX / window.innerWidth) * 2 - 1;
    const ndcY = -(mouseY / window.innerHeight) * 2 + 1;
    
    // 创建射线
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    
    // 计算与Z=0平面的交点
    // 射线方程: P = O + t * D
    // 平面方程: Z = 0
    // 求解: O.z + t * D.z = 0
    const origin = raycaster.ray.origin;
    const direction = raycaster.ray.direction;
    
    if (Math.abs(direction.z) > 0.0001) {
        const t = -origin.z / direction.z;
        const worldPos = new THREE.Vector3(
            origin.x + t * direction.x,
            origin.y + t * direction.y,
            0
        );
        return worldPos;
    }
    
    return null;
}

renderer.domElement.addEventListener('mousedown', (event) => {
    const idx = getIntersectedModelIndex(event);
    if (idx !== -1 && hoveredModelIndex !== -1) {
        draggingModelIndex = idx;
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
        
        // 保存拖动前的位置和缩放
        modelPreDragPositions[idx] = {
            x: models[idx].position.x,
            y: models[idx].position.y,
            z: models[idx].position.z
        };
        modelPreDragScales[idx] = models[idx].scale.x;
        
        document.body.style.cursor = 'grabbing';
    }
});

renderer.domElement.addEventListener('mousemove', (event) => {
    if (draggingModelIndex !== -1) {
        // 实时跟随鼠标移动模型
        const worldPos = getWorldCoordinateFromMouse(event);
        if (worldPos) {
            models[draggingModelIndex].position.x = worldPos.x;
            models[draggingModelIndex].position.y = worldPos.y;
            models[draggingModelIndex].position.z = 0;
        }
        
        document.body.style.cursor = 'grabbing';
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
    } else {
        // 检测悬停
        const idx = getIntersectedModelIndex(event);
        if (idx !== hoveredModelIndex) {
            // 如果之前有悬停的模型，停止它的旋转
            if (hoveredModelIndex !== -1) {
                modelHoverRotations[hoveredModelIndex] = 0;
            }
            
            hoveredModelIndex = idx;
            
            // 更新所有模型的目标缩放
            for (let i = 0; i < models.length; i++) {
                modelData[i].targetScale = (i === hoveredModelIndex) ? HOVER_SCALE : NORMAL_SCALE;
            }
            
            // 如果新悬停的模型不是-1，启动自动旋转
            if (hoveredModelIndex !== -1) {
                modelHoverRotations[hoveredModelIndex] = 0.01;  // 旋转速度
            }
        }
        document.body.style.cursor = idx !== -1 ? 'pointer' : 'default';
    }
});

renderer.domElement.addEventListener('mouseup', (event) => {
    // 检查松开鼠标时模型是否在右侧框内
    if (draggingModelIndex !== -1 && isMouseInRightBox(event)) {
        selectedModel = draggingModelIndex;
        console.log('Model placed in selection box:', draggingModelIndex);
    }
    
    // 停止旋转
    if (draggingModelIndex !== -1) {
        modelHoverRotations[draggingModelIndex] = 0;
    }
    
    draggingModelIndex = -1;
    document.body.style.cursor = hoveredModelIndex !== -1 ? 'pointer' : 'default';
});

// Handle window resize
window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// 按钮事件处理
const confirmButton = document.getElementById('confirmButton');
const resetButton = document.getElementById('resetButton');

confirmButton.addEventListener('click', () => {
    if (selectedModel !== null) {
        console.log('确定选择模型:', selectedModel);
        // 这里可以添加你想要执行的操作
        // 比如：提交选择、跳转页面等
        alert('你选择了 DunDun ' + (selectedModel + 1) + '!');
    } else {
        alert('请先选择一个模型');
    }
});

// 重置按钮：将模型恢复到拖动前的位置和缩放
resetButton.addEventListener('click', () => {
    if (selectedModel !== null) {
        // 直接恢复到拖动前的位置和缩放
        const model = models[selectedModel];
        model.position.x = modelPreDragPositions[selectedModel].x;
        model.position.y = modelPreDragPositions[selectedModel].y;
        model.position.z = modelPreDragPositions[selectedModel].z;
        
        const scale = modelPreDragScales[selectedModel];
        model.scale.set(scale, scale, scale);
        
        // 清除选中状态
        selectedModel = null;
        console.log('Model reset to pre-drag position');
    }
});

// 初始化：禁用按钮（直到有模型被选中）
function updateButtonState() {
    if (selectedModel !== null) {
        confirmButton.disabled = false;
        confirmButton.textContent = '确定';
        resetButton.disabled = false;
        resetButton.textContent = '重置';
    } else {
        confirmButton.disabled = true;
        confirmButton.textContent = 'Adopt';
        resetButton.disabled = true;
        resetButton.textContent = 'Choose Another';
    }
}

// 定期更新按钮状态
setInterval(updateButtonState, 100);

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update(); // Required for damping
    
    // 平滑缩放动画（悬停效果）和悬停旋转
    for (let i = 0; i < models.length; i++) {
        if (models[i]) {
            // 缩放动画
            const currentScale = models[i].scale.x;
            const targetScale = modelData[i].targetScale;
            const newScale = currentScale + (targetScale - currentScale) * 0.1;
            models[i].scale.set(newScale, newScale, newScale);
            
            // 悬停旋转
            if (modelHoverRotations[i] > 0) {
                models[i].rotation.y += modelHoverRotations[i];
            }
        }
    }
    
    renderer.render(scene, camera);
}

animate();
