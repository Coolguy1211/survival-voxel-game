
// Game state variables
let scene, camera, renderer;
let controls;
let health = 100;
let hunger = 100;
let hungerInterval;
let world = [];
const worldSize = 32;
const blockSize = 1;
const playerSpeed = 0.05;
const hungerDrainRate = 0.1;

// UI elements
const healthFill = document.getElementById('health-fill');
const hungerFill = document.getElementById('hunger-fill');
const statusMessage = document.getElementById('status-message');
const loadingScreen = document.getElementById('loading-screen');
const gameContainer = document.getElementById('game-container');

const blocks = {
    stone: new THREE.MeshLambertMaterial({ color: 0x808080 }),
    dirt: new THREE.MeshLambertMaterial({ color: 0x654321 }),
    grass: new THREE.MeshLambertMaterial({ color: 0x00A000 }),
    wood: new THREE.MeshLambertMaterial({ color: 0x8B4513 }),
    leaf: new THREE.MeshLambertMaterial({ color: 0x006400 }),
    sand: new THREE.MeshLambertMaterial({ color: 0xF4A460 }),
    water: new THREE.MeshLambertMaterial({ color: 0x00BFFF, transparent: true, opacity: 0.8 }),
};

const keyStates = {};
let mousePosition = new THREE.Vector2();
let raycaster = new THREE.Raycaster();
let intersectedObject;

// Perlin noise implementation
const Perlin = {
    rand_vect: function(){
        let theta = Math.random() * 2 * Math.PI;
        return {x: Math.cos(theta), y: Math.sin(theta)};
    },
    dot_prod_grid: function(x, y, vx, vy){
        let g_vect;
        let d_vect = {x: x - vx, y: y - vy};
        if (this.G) {
            g_vect = this.G[[vx, vy]];
        } else {
            g_vect = this.rand_vect();
        }
        return d_vect.x * g_vect.x + d_vect.y * g_vect.y;
    },
    smootherstep: function(x){
        return 6*x**5 - 15*x**4 + 10*x**3;
    },
    interp: function(x, a, b){
        return a + this.smootherstep(x) * (b-a);
    },
    seed: function(){
        this.G = {};
        for (let i=0; i<256; i++) {
            this.G[i] = this.rand_vect();
        }
    },
    get: function(x, y) {
        if (!this.G) {
            this.seed();
        }
        let xf = Math.floor(x);
        let yf = Math.floor(y);
        //interpolate
        let tl = this.dot_prod_grid(x, y, xf,   yf);
        let tr = this.dot_prod_grid(x, y, xf+1, yf);
        let bl = this.dot_prod_grid(x, y, xf,   yf+1);
        let br = this.dot_prod_grid(x, y, xf+1, yf+1);
        let xt = this.interp(x-xf, tl, tr);
        let xb = this.interp(x-xf, bl, br);
        return this.interp(y-yf, xt, xb);
    }
};

// Helper function to show a temporary message
function showMessage(text) {
    statusMessage.textContent = text;
    statusMessage.style.opacity = 1;
    clearTimeout(statusMessage.timeout);
    statusMessage.timeout = setTimeout(() => {
        statusMessage.style.opacity = 0;
    }, 2000);
}

// Helper function to create a block mesh
function createBlockMesh(x, y, z, type) {
    const geometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
    const material = blocks[type];
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.userData.position = new THREE.Vector3(x, y, z); // Store original position
    mesh.userData.type = type; // Store block type
    return mesh;
}

// Generate a more interesting world with Perlin noise
function generateWorld() {
    world = [];
    Perlin.seed();
    for (let x = 0; x < worldSize; x++) {
        world[x] = [];
        for (let z = 0; z < worldSize; z++) {
            const height = Math.floor(Perlin.get(x / 16, z / 16) * 8) + 8;
            for (let y = 0; y < height; y++) {
                if (!world[x][y]) world[x][y] = [];
                let type;
                if (y === height - 1) {
                    type = 'grass';
                } else if (y > height - 4) {
                    type = 'dirt';
                } else {
                    type = 'stone';
                }
                const block = createBlockMesh(x, y, z, type);
                scene.add(block);
                world[x][y][z] = block;
            }
            // Add trees
            if (Math.random() < 0.05) {
                const treeHeight = Math.floor(Math.random() * 3) + 4;
                for (let i = 0; i < treeHeight; i++) {
                    const y = height + i;
                    if (!world[x][y]) world[x][y] = [];
                    const block = createBlockMesh(x, y, z, 'wood');
                    scene.add(block);
                    world[x][y][z] = block;
                }
                for (let dx = -2; dx <= 2; dx++) {
                    for (let dy = -2; dy <= 2; dy++) {
                        for (let dz = -2; dz <= 2; dz++) {
                            if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 3) continue;
                            const y = height + treeHeight + dy;
                            if (!world[x + dx] || !world[x + dx][y]) {
                                if (!world[x+dx]) world[x+dx] = [];
                                if (!world[x+dx][y]) world[x+dx][y] = [];
                                const block = createBlockMesh(x + dx, y, z + dz, 'leaf');
                                scene.add(block);
                                world[x+dx][y][z+dz] = block;
                            }
                        }
                    }
                }
            }
        }
    }
}

// Save world data to localStorage
function saveWorld() {
    try {
        const serializableWorld = [];
        for (let x = 0; x < world.length; x++) {
            if (!world[x]) continue;
            for (let y = 0; y < world[x].length; y++) {
                if (!world[x][y]) continue;
                for (let z = 0; z < world[x][y].length; z++) {
                    const block = world[x][y][z];
                    if (block) {
                        serializableWorld.push({
                            x: block.position.x,
                            y: block.position.y,
                            z: block.position.z,
                            type: block.userData.type
                        });
                    }
                }
            }
        }
        localStorage.setItem('world', JSON.stringify(serializableWorld));
        localStorage.setItem('health', health);
        localStorage.setItem('hunger', hunger);
        showMessage("World saved successfully!");
    } catch (e) {
        console.error("Error saving world: ", e);
        showMessage("Failed to save world.");
    }
}

// Load world data from localStorage
function loadWorld() {
    try {
        const loadedWorldData = localStorage.getItem('world');
        if (loadedWorldData) {
            const loadedWorld = JSON.parse(loadedWorldData);
            const loadedHealth = localStorage.getItem('health');
            const loadedHunger = localStorage.getItem('hunger');
            health = loadedHealth ? parseFloat(loadedHealth) : 100;
            hunger = loadedHunger ? parseFloat(loadedHunger) : 100;
            updateHealthUI();
            updateHungerUI();

            // Clear existing world
            scene.children.forEach(child => {
                if (child.isMesh && child.userData.type) {
                    scene.remove(child);
                    child.geometry.dispose();
                    child.material.dispose();
                }
            });
            world = [];
            // Rebuild the world from loaded data
            loadedWorld.forEach(blockData => {
                const block = createBlockMesh(blockData.x, blockData.y, blockData.z, blockData.type);
                scene.add(block);
                if (!world[blockData.x]) world[blockData.x] = [];
                if (!world[blockData.x][blockData.y]) world[blockData.x][blockData.y] = [];
                world[blockData.x][blockData.y][blockData.z] = block;
            });

            showMessage("World loaded successfully!");
        } else {
            showMessage("No saved world found. Starting new game.");
            generateWorld();
        }
    } catch (e) {
        console.error("Error loading world: ", e);
        showMessage("Failed to load world.");
    }
}

// Set up scene, camera, and renderer
function init() {
    scene = new THREE.Scene();

    // Skybox
    const loader = new THREE.CubeTextureLoader();
    loader.setPath('textures/sky_05_cubemap_2k/');
    const textureCube = loader.load([
        'px.png', 'nx.png',
        'py.png', 'ny.png',
        'pz.png', 'nz.png'
    ]);
    scene.background = textureCube;

    scene.fog = new THREE.Fog(0x87ceeb, 10, 50);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(worldSize / 2, 10, worldSize / 2);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    gameContainer.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(50, 100, 50);
    scene.add(directionalLight);

    // Add control buttons to the HUD
    const hud = document.getElementById('hud');
    const saveButton = document.createElement('button');
    saveButton.className = 'button';
    saveButton.textContent = 'Save World';
    saveButton.addEventListener('click', saveWorld);
    hud.appendChild(saveButton);

    const loadButton = document.createElement('button');
    loadButton.className = 'button';
    loadButton.textContent = 'Load World';
    loadButton.addEventListener('click', loadWorld);
    hud.appendChild(loadButton);

    // Player controls
    document.addEventListener('keydown', (event) => keyStates[event.code] = true);
    document.addEventListener('keyup', (event) => keyStates[event.code] = false);

    document.addEventListener('mousemove', (event) => {
        if (document.pointerLockElement === renderer.domElement) {
            camera.rotation.order = 'YXZ';
            camera.rotation.y -= event.movementX * 0.002;
            camera.rotation.x -= event.movementY * 0.002;
            camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
        }
    });

    // Pointer lock for mouse control
    renderer.domElement.addEventListener('click', () => {
        renderer.domElement.requestPointerLock();
    });

    // Block building/destroying
    renderer.domElement.addEventListener('mousedown', (event) => {
        if (document.pointerLockElement !== renderer.domElement) return;

        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        const intersects = raycaster.intersectObjects(scene.children);

        if (intersects.length > 0) {
            intersectedObject = intersects[0];
            const block = intersectedObject.object;

            // Remove block (left click)
            if (event.button === 0) {
                if (block.userData.type) {
                    scene.remove(block);
                    block.geometry.dispose();
                    block.material.dispose();

                    const { x, y, z } = block.userData.position;
                    if (world[x] && world[x][y] && world[x][y][z]) {
                        world[x][y][z] = null;
                    }
                }
            }
            // Place block (right click)
            else if (event.button === 2) {
                const normal = intersectedObject.face.normal;
                const pos = block.position.clone().add(normal);

                const newBlock = createBlockMesh(pos.x, pos.y, pos.z, 'wood');
                scene.add(newBlock);
                if (!world[pos.x]) world[pos.x] = [];
                if (!world[pos.x][pos.y]) world[pos.x][pos.y] = [];
                world[pos.x][pos.y][pos.z] = newBlock;
            }
        }
    });

    // Disable context menu on right click
    renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

    // Start the hunger drain
    hungerInterval = setInterval(drainHunger, 1000);
}

// Update health bar UI
function updateHealthUI() {
    healthFill.style.width = `${health}%`;
    if (health < 50) {
        healthFill.style.backgroundColor = 'red';
    } else if (health < 100) {
        healthFill.style.backgroundColor = 'yellow';
    } else {
        healthFill.style.backgroundColor = 'green';
    }
}

// Update hunger bar UI
function updateHungerUI() {
    hungerFill.style.width = `${hunger}%`;
}

// Drain hunger over time
function drainHunger() {
    if (hunger > 0) {
        hunger -= hungerDrainRate;
        updateHungerUI();
    } else {
        if (health > 0) {
            health -= hungerDrainRate * 2; // Health drains twice as fast as hunger
            updateHealthUI();
        }
    }
}

// Main animation loop
function animate() {
    requestAnimationFrame(animate);

    // Player movement
    const direction = new THREE.Vector3();
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();

    camera.getWorldDirection(forward);
    right.crossVectors(forward, camera.up);

    if (keyStates['KeyW']) camera.position.add(forward.multiplyScalar(playerSpeed));
    if (keyStates['KeyS']) camera.position.add(forward.multiplyScalar(-playerSpeed));
    if (keyStates['KeyA']) camera.position.add(right.multiplyScalar(-playerSpeed));
    if (keyStates['KeyD']) camera.position.add(right.multiplyScalar(playerSpeed));

    renderer.render(scene, camera);
}

// Start the game after all resources are loaded
window.onload = function() {
    // Initialize the game
    init();
    // Load world from local storage or generate new one
    loadWorld();
    // Start the animation loop
    animate();
    // Hide loading screen
    loadingScreen.style.display = 'none';
}

// Handle window resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
