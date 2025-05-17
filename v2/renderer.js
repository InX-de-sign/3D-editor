const { MeshBVH, acceleratedRaycast } = require('three-mesh-bvh');
const { GLTFLoader } = require('three/examples/jsm/loaders/GLTFLoader.js');
console.log('Starting renderer.js');


/* for model display*/
let model;
let previousPointerPosition = { x: 0, y: 0 };

/*for sculpting mode*/
// let isSculptingMode = false;
let sculptButton = null; //intrude(right mouse) or extrude(left mouse)
let intersectPoint = null;
let sculptModeButton = null; 
let addButton = null; 
let subtractButton = null;
let currentSculptAction = null; 
let sculptIndicator = null;

/*for user touch events*/
let initialTouchDistance = 0;
let isZooming = false;


const sculptingState = {
    isActive: false,        
    currentAction: null,    // 'add' or 'subtract'
    intersectPoint: null,   // Where the touch intersects with the model
    touchActive: false      // Replaces isPointerDown
};

const THREE = require('three');
THREE.BufferGeometry.prototype.computeBoundsTree = MeshBVH.prototype.computeBoundsTree;
THREE.BufferGeometry.prototype.raycast = acceleratedRaycast;

const path = require('path');
console.log('THREE.js and modules loaded successfully');

/*setting up scene, camera, and renderer*/
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x808080);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;
const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
});
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(0, 0);

function createButton(text, id) {
    const button = document.createElement('button');
    button.id = id;
    button.className = 'sculpt-button';
    button.innerHTML = text;
    document.body.appendChild(button);
    return button;
}

function createSculptingIndicator() {
    sculptIndicator = document.createElement('div');
    sculptIndicator.className = 'sculpt-indicator';
    document.body.appendChild(sculptIndicator);
}

function toggleSculptMode() {
    sculptingState.isActive = !sculptingState.isActive;
    isSculptingMode = sculptingState.isActive;
    updateUIState();
}

function updateUIState() {
    sculptModeButton.classList.toggle('active', sculptingState.isActive);
    addButton.style.display = sculptingState.isActive ? 'block' : 'none';
    subtractButton.style.display = sculptingState.isActive ? 'block' : 'none';
    console.log('Sculpting mode:', sculptingState.isActive);
}

function setSculptAction(action) {
    sculptingState.currentAction = action;
    currentSculptAction = action;
    addButton.classList.toggle('active', action === 'add');
    subtractButton.classList.toggle('active', action === 'subtract');
}

function createSculptingUI() {
    sculptModeButton = createButton('Sculpt Mode', 'sculptMode-btn');
    addButton = createButton('Add', 'add-btn');
    subtractButton = createButton('Subtract', 'subtract-btn');

    sculptModeButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        toggleSculptMode();
    });

    addButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        setSculptAction('add');
    });

    subtractButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        setSculptAction('subtract');
    });

    createSculptingIndicator();
    updateUIState();
}

// finetune sculpting patameters for the LCD screen
function sculpt(radius = 0.5, strength = 0.1) {
    if (!model) {
        console.error('Cannot sculpt: Model is undefined.');
        return;
    } else if (!model.mesh.geometry) {
        console.error('Cannot sculpt: Model mesh geometry is undefined.');
        return
    } else if (!intersectPoint) {
        console.error('Cannot sculpt: Intersect point is undefined.');
        return
    }

    const geometry = model.mesh.geometry;
    const positionAttribute = geometry.attributes.position;

    if (!geometry.boundsTree) {
        geometry.boundsTree = new MeshBVH(geometry);
    }

    for (let i = 0; i < positionAttribute.count; i++) {
        const x = positionAttribute.getX(i);
        const y = positionAttribute.getY(i);
        const z = positionAttribute.getZ(i);

        const vertex = new THREE.Vector3(x, y, z);
        const distance = vertex.distanceTo(intersectPoint);

        if (distance < radius) {
            const direction = sculptButton === 'intrude' ? -1 : 1;
            const falloff=1-(distance/radius);
            const displacement=strength*falloff*direction;

            positionAttribute.setXYZ(i,
                vertex.x + (intersectPoint.x - vertex.x) * displacement,
                vertex.y + (intersectPoint.y - vertex.y) * displacement,
                vertex.z + (intersectPoint.z - vertex.z) * displacement);
        }
    }
    positionAttribute.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.boundsTree = null;
    console.log('Geometry modified');
}

/*initializing renderer and UI*/
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
console.log('Renderer created and canvas appended');

createSculptingUI();

/*setting up lights*/
const light = new THREE.AmbientLight(0xffffff, 1);
light.position.set(1, 1, 1);
scene.add(light);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

const modelPath = path.join(__dirname, 'models', 'sampleModel1.glb');
console.log('Attempting to load model from:', modelPath);

const loader = new GLTFLoader();
loader.load(modelPath,
    (gltf) => {
        model = gltf.scene;
        model.traverse((child) => {
            if (child.isMesh && child.geometry) {
                model.mesh = child;
                child.geometry.computeBoundsTree = new MeshBVH(child.geometry);
            }
        });

        camera.position.z = 10;
        model.scale.set(0.2, 0.2, 0.2);
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        model.position.y = 0;

        scene.add(model);
        console.log('Model loaded successfully');
    },
    (progress) => {
        console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
    },
    (error) => {
        console.error('Error loading model:', error);
    }
);


/* Two-finger: zooming*/
window.addEventListener('touchstart', (event) => {
    if (event.touches.length === 2) {
        isZooming = true;
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        initialTouchDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );
        return;
    }

/* Single touch: rotation*/
    if (!isSculptingMode || !currentSculptAction) {
        isPointerDown = true;
        const touch = event.touches[0];
        previousPointerPosition = { x: touch.clientX, y: touch.clientY };
        return;
    }

/* Sculpting touch handling*/
    const touch = event.touches[0];
    if (model.mesh) {
        pointer.x = (touch.clientX / window.innerWidth) * 2 - 1;
        pointer.y = -(touch.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);

        const intersects = raycaster.intersectObject(model.mesh, true);
        if (intersects.length > 0) {
            intersectPoint = intersects[0].point;
            sculpt();
        }
    }
});
    
window.addEventListener('touchmove', (event) => {
    event.preventDefault(); 

    if (!model) return;
    // zooming in/out with two fingers
    if (event.touches.length === 2) {
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        const currentDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );

        if (initialTouchDistance > 0) {
            const delta = (currentDistance - initialTouchDistance) * 0.01; // Adjust sensitivity here
            camera.position.z = Math.max(1, Math.min(100, camera.position.z - delta));
            controls.update();
        }
        initialTouchDistance = currentDistance;
        return;
    }

    // rotating with single finger
    const touch = event.touches[0];
    if (!isSculptingMode) {
        const deltaMove = {
            x: touch.clientX - previousPointerPosition.x,
            y: touch.clientY - previousPointerPosition.y
        };

        const rotationSensitivity = 0.015; 
        model.rotation.y += deltaMove.x * rotationSensitivity;
        model.rotation.x += deltaMove.y * rotationSensitivity;

        previousPointerPosition = {
            x: touch.clientX,
            y: touch.clientY
        };
    } else if (currentSculptAction) {
        pointer.x = (touch.clientX / window.innerWidth) * 2 - 1;
        pointer.y = -(touch.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObject(model.mesh, true);
        
        if (intersects.length > 0) {
            intersectPoint = intersects[0].point;
            sculpt();
        }
    }
});

window.addEventListener('touchend', (event) => {
    isPointerDown = false;
    isZooming = false;
    initialTouchDistance = 0;
});
