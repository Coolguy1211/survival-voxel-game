
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
const playerHeight = 1.8;
const playerWidth = 0.8;
const gravity = -0.005;
let playerVelocity = new THREE.Vector3(0, 0, 0);
let onGround = false;
const hungerDrainRate = 0.1;

// UI elements
const healthFill = document.getElementById('health-fill');
const hungerFill = document.getElementById('hunger-fill');
const statusMessage = document.getElementById('status-message');
const loadingScreen = document.getElementById('loading-screen');
const gameContainer = document.getElementById('game-container');
const mainMenu = document.getElementById('main-menu');
const newGameBtn = document.getElementById('new-game-btn');
const loadGameBtn = document.getElementById('load-game-btn');
const settingsBtn = document.getElementById('settings-btn');
const hotbarEl = document.getElementById('hotbar');
const inventoryEl = document.getElementById('inventory');
const inventoryGrid = document.getElementById('inventory-grid');
const mobileControls = document.getElementById('mobile-controls');
const joystick = document.getElementById('joystick');
const joystickContainer = document.getElementById('joystick-container');
const jumpBtn = document.getElementById('jump-btn');
const placeBtn = document.getElementById('place-btn');
const breakBtn = document.getElementById('break-btn');

const inventorySize = 27;
const hotbarSize = 9;
let inventoryData = new Array(inventorySize).fill(null);
let hotbarData = new Array(hotbarSize).fill(null);
let selectedSlot = 0;

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
            const index = (vx * 13 + vy * 31) % 256;
            g_vect = this.G[Math.abs(index)];
        } else {
            g_vect = this.rand_vect();
        }
        if (!g_vect) {
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

function checkCollision(position) {
    const minX = Math.floor(position.x - playerWidth / 2);
    const maxX = Math.floor(position.x + playerWidth / 2);
    const minZ = Math.floor(position.z - playerWidth / 2);
    const maxZ = Math.floor(position.z + playerWidth / 2);
    const minY = Math.floor(position.y - playerHeight);
    const maxY = Math.floor(position.y);

    for (let x = minX; x <= maxX; x++) {
        for (let z = minZ; z <= maxZ; z++) {
            for (let y = minY; y <= maxY; y++) {
                if (world[x] && world[x][y] && world[x][y][z]) {
                    return true; // Collision
                }
            }
        }
    }
    return false; // No collision
}

function getSpawnHeight(x, z) {
    for (let y = worldSize * 2; y >= 0; y--) {
        if (world[x] && world[x][y] && world[x][y][z]) {
            return y + 2;
        }
    }
    return 10;
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
                            const newX = x + dx;
                            const newZ = z + dz;
                            if (newX >= 0 && newX < worldSize && newZ >= 0 && newZ < worldSize) {
                                const y = height + treeHeight + dy;
                                if (!world[newX]) {
                                    world[newX] = [];
                                }
                                if (!world[newX][y]) {
                                    world[newX][y] = [];
                                }
                                if (!world[newX][y][newZ]) {
                                    const block = createBlockMesh(newX, y, newZ, 'leaf');
                                    scene.add(block);
                                    world[newX][y][newZ] = block;
                                }
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
function initMobileControls() {
    if ('ontouchstart' in window) {
        mobileControls.style.display = 'block';

        joystickContainer.addEventListener('touchstart', handleJoystickStart, { passive: false });
        joystickContainer.addEventListener('touchmove', handleJoystickMove, { passive: false });
        joystickContainer.addEventListener('touchend', handleJoystickEnd, { passive: false });

        jumpBtn.addEventListener('touchstart', () => {
            if (onGround) {
                playerVelocity.y = 0.15;
                onGround = false;
            }
        });

        placeBtn.addEventListener('touchstart', () => handleBlockInteraction(false));
        breakBtn.addEventListener('touchstart', () => handleBlockInteraction(true));

        let lookStartX, lookStartY;
        renderer.domElement.addEventListener('touchstart', (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (touch.clientX > window.innerWidth / 2) {
                    lookStartX = touch.clientX;
                    lookStartY = touch.clientY;
                }
            }
        });
        renderer.domElement.addEventListener('touchmove', (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (touch.clientX > window.innerWidth / 2) {
                    const dx = touch.clientX - lookStartX;
                    const dy = touch.clientY - lookStartY;
                    camera.rotation.y -= dx * 0.002;
                    camera.rotation.x -= dy * 0.002;
                    camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
                    lookStartX = touch.clientX;
                    lookStartY = touch.clientY;
                }
            }
        });
    }
}

function handleBlockInteraction(isBreaking) {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObjects(scene.children);

    if (intersects.length > 0) {
        const intersectedObject = intersects[0];
        const block = intersectedObject.object;

        if (isBreaking) {
            if (block.userData.type) {
                const blockType = block.userData.type;
                const { x, y, z } = block.userData.position;
                scene.remove(block);
                block.geometry.dispose();
                block.material.dispose();

                if (world[x] && world[x][y] && world[x][y][z]) {
                    world[x][y][z] = null;
                }
                addToInventory(blockType);
            }
        } else {
            const selectedItem = hotbarData[selectedSlot];
            if (selectedItem) {
                const normal = intersectedObject.face.normal;
                const pos = block.position.clone().add(normal);
                const { x, y, z } = pos;

                const newBlock = createBlockMesh(x, y, z, selectedItem.type);
                scene.add(newBlock);
                if (!world[x]) world[x] = [];
                if (!world[x][y]) world[x][y] = [];
                world[x][y][z] = newBlock;

                selectedItem.count--;
                if (selectedItem.count === 0) {
                    hotbarData[selectedSlot] = null;
                }
                renderHotbar();
            }
        }
    }
}

function handleJoystickStart(e) {
    e.preventDefault();
    const touch = e.changedTouches[0];
    moveJoystick(touch.clientX, touch.clientY);
}

function handleJoystickMove(e) {
    e.preventDefault();
    const touch = e.changedTouches[0];
    moveJoystick(touch.clientX, touch.clientY);
}

function handleJoystickEnd(e) {
    e.preventDefault();
    joystick.style.transform = 'translate(-50%, -50%)';
    keyStates['KeyW'] = false;
    keyStates['KeyS'] = false;
    keyStates['KeyA'] = false;
    keyStates['KeyD'] = false;
}

function moveJoystick(x, y) {
    const rect = joystickContainer.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = x - centerX;
    const dy = y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    const maxDist = rect.width / 2 - joystick.width / 2;
    const clampedDist = Math.min(distance, maxDist);

    const newX = clampedDist * Math.cos(angle);
    const newY = clampedDist * Math.sin(angle);

    joystick.style.transform = `translate(calc(-50% + ${newX}px), calc(-50% + ${newY}px))`;

    // Update keyStates based on joystick position
    const threshold = 0.5;
    keyStates['KeyW'] = dy < -maxDist * threshold;
    keyStates['KeyS'] = dy > maxDist * threshold;
    keyStates['KeyA'] = dx < -maxDist * threshold;
    keyStates['KeyD'] = dx > maxDist * threshold;
}

function init() {
    scene = new THREE.Scene();
    initMobileControls();

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
    // camera.position.set(worldSize / 2, 10, worldSize / 2);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    gameContainer.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(50, 100, 50);
    scene.add(directionalLight);


    // Player controls
    document.addEventListener('keydown', (event) => {
        keyStates[event.code] = true;
        if (event.code === 'Space' && onGround) {
            playerVelocity.y = 0.15;
            onGround = false;
        }
        if (event.code === 'KeyE') {
            inventoryEl.style.display = inventoryEl.style.display === 'none' ? 'flex' : 'none';
            // Also toggle pointer lock
            if (inventoryEl.style.display === 'none') {
                renderer.domElement.requestPointerLock();
            } else {
                document.exitPointerLock();
            }
        }
    });
    document.addEventListener('keyup', (event) => keyStates[event.code] = false);

    // Hotbar selection
    window.addEventListener('wheel', (event) => {
        if (event.deltaY > 0) {
            selectedSlot = (selectedSlot + 1) % hotbarSize;
        } else {
            selectedSlot = (selectedSlot - 1 + hotbarSize) % hotbarSize;
        }
        renderHotbar();
    });

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

        if (event.button === 0) { // Left click
            handleBlockInteraction(true); // Break block
        } else if (event.button === 2) { // Right click
            handleBlockInteraction(false); // Place block
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

    // Update player velocity based on input
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();

    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, camera.up);

    let moveDirection = new THREE.Vector3(0, 0, 0);
    if (keyStates['KeyW']) moveDirection.add(forward);
    if (keyStates['KeyS']) moveDirection.sub(forward);
    if (keyStates['KeyA']) moveDirection.sub(right);
    if (keyStates['KeyD']) moveDirection.add(right);

    if (moveDirection.length() > 0) {
        moveDirection.normalize();
        playerVelocity.x = moveDirection.x * playerSpeed;
        playerVelocity.z = moveDirection.z * playerSpeed;
    } else {
        playerVelocity.x = 0;
        playerVelocity.z = 0;
    }

    // Apply gravity
    playerVelocity.y += gravity;

    // Move and collide
    let playerPosition = camera.position;

    // Y-axis
    playerPosition.y += playerVelocity.y;
    if (checkCollision(playerPosition)) {
        if (playerVelocity.y < 0) {
            onGround = true;
        }
        playerPosition.y -= playerVelocity.y;
        playerVelocity.y = 0;
    } else {
        onGround = false;
    }

    // X-axis
    playerPosition.x += playerVelocity.x;
    if (checkCollision(playerPosition)) {
        playerPosition.x -= playerVelocity.x;
    }

    // Z-axis
    playerPosition.z += playerVelocity.z;
    if (checkCollision(playerPosition)) {
        playerPosition.z -= playerVelocity.z;
    }


    renderer.render(scene, camera);
}

function renderHotbar() {
    hotbarEl.innerHTML = '';
    for (let i = 0; i < hotbarSize; i++) {
        const slot = document.createElement('div');
        slot.className = 'slot';
        if (i === selectedSlot) {
            slot.classList.add('selected');
        }
        const item = hotbarData[i];
        if (item) {
            slot.textContent = item.count;
            // TODO: Add item icon
        }
        hotbarEl.appendChild(slot);
    }
}

function addToInventory(type) {
    // Try to stack in hotbar
    for (let i = 0; i < hotbarSize; i++) {
        if (hotbarData[i] && hotbarData[i].type === type && hotbarData[i].count < 64) {
            hotbarData[i].count++;
            renderHotbar();
            return;
        }
    }
    // Try to stack in inventory
    for (let i = 0; i < inventorySize; i++) {
        if (inventoryData[i] && inventoryData[i].type === type && inventoryData[i].count < 64) {
            inventoryData[i].count++;
            renderInventory();
            return;
        }
    }
    // Find empty slot in hotbar
    for (let i = 0; i < hotbarSize; i++) {
        if (!hotbarData[i]) {
            hotbarData[i] = { type: type, count: 1 };
            renderHotbar();
            return;
        }
    }
    // Find empty slot in inventory
    for (let i = 0; i < inventorySize; i++) {
        if (!inventoryData[i]) {
            inventoryData[i] = { type: type, count: 1 };
            renderInventory();
            return;
        }
    }
    // Inventory is full
    showMessage("Inventory is full!");
}

function renderInventory() {
    inventoryGrid.innerHTML = '';
    for (let i = 0; i < inventorySize; i++) {
        const slot = document.createElement('div');
        slot.className = 'slot';
        const item = inventoryData[i];
        if (item) {
            slot.textContent = item.count;
            // TODO: Add item icon
        }
        inventoryGrid.appendChild(slot);
    }
}

function startGame(newGame) {
    console.log("Starting game...");
    mainMenu.style.display = 'none';
    loadingScreen.style.display = 'flex';
    gameContainer.style.display = 'flex';

    init();
    if (newGame) {
        generateWorld();
        const spawnX = Math.floor(worldSize / 2);
        const spawnZ = Math.floor(worldSize / 2);
        const spawnY = getSpawnHeight(spawnX, spawnZ);
        camera.position.set(spawnX, spawnY, spawnZ);
    } else {
        loadWorld();
    }
    animate();
    loadingScreen.style.display = 'none';
    renderHotbar();
    renderInventory();
}

// Start the game after all resources are loaded
window.onload = function() {
    newGameBtn.addEventListener('click', () => startGame(true));
    loadGameBtn.addEventListener('click', () => startGame(false));
    // settingsBtn.addEventListener('click', () => { /* TODO */ });
}

// Handle window resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
