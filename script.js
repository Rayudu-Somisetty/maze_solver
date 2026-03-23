// Game Configuration
const CONFIG = {
    CELL_TYPES: {
        WALL: 0,
        PATH: 1,
        START: 2,
        GOAL: 3,
        USER_PATH: 4,
        OPTIMAL_PATH: 5
    },
    COLORS: {
        WALL: '#2c3e50',
        PATH: '#ecf0f1',
        START: '#27ae60',
        GOAL: '#e74c3c',
        USER_PATH: '#3498db',
        OPTIMAL_PATH: '#f39c12',
        USER_OPTIMAL_OVERLAP: '#a0522d'
    }
};

class MazeGame {
    constructor() {
        this.canvas = document.getElementById('mazeCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.gridSize = 15;
        this.cellSize = 40;
        this.maze = [];
        this.start = null;
        this.goal = null;
        this.userPath = [];
        this.optimalPath = [];
        this.isDrawing = false;
        this.canSubmit = false;
        this.gameState = 'idle'; // idle, playing, submitted
        this.showOptimal = false; // Toggle for showing optimal path

        this.initEventListeners();
        this.updateCanvasSize();
    }

    initEventListeners() {
        document.getElementById('generateBtn').addEventListener('click', () => this.generateNewMaze());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetUserPath());
        document.getElementById('submitBtn').addEventListener('click', () => this.submitPath());
        document.getElementById('showOptimalBtn').addEventListener('click', () => this.toggleOptimalPath());
        document.getElementById('gridSize').addEventListener('change', (e) => {
            this.gridSize = parseInt(e.target.value);
            this.updateCanvasSize();
            this.generateNewMaze();
        });

        // Mouse events for drawing
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseleave', () => this.stopDrawing());

        // Touch events for mobile
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startDrawing(this.touchToMouse(e));
        });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.draw(this.touchToMouse(e));
        });
        this.canvas.addEventListener('touchend', () => this.stopDrawing());
    }

    touchToMouse(e) {
        const touch = e.touches[0];
        return new MouseEvent('mouse', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
    }

    generateNewMaze() {
        this.gameState = 'playing';
        this.userPath = [];
        this.optimalPath = [];
        this.canSubmit = false;
        this.showOptimal = false;
        document.getElementById('submitBtn').disabled = true;
        document.getElementById('showOptimalBtn').disabled = true;
        document.getElementById('showOptimalBtn').textContent = '👁️ Show Optimal Path';
        this.clearStatus();
        this.clearStats();

        this.maze = this.generateMazeByDFS();
        this.placeStartAndGoal();
        this.calculateOptimalPath();
        this.redraw();
        this.showStatus('Maze generated! Draw your path from start to goal.', 'info');
    }

    generateMazeByDFS() {
        // Initialize maze with all walls
        let maze = Array(this.gridSize).fill(null).map(() => 
            Array(this.gridSize).fill(CONFIG.CELL_TYPES.WALL)
        );

        // Step 1: Recursive backtracking DFS for base structure
        const visited = Array(this.gridSize).fill(null).map(() => 
            Array(this.gridSize).fill(false)
        );

        const carvePassage = (x, y) => {
            visited[y][x] = true;
            maze[y][x] = CONFIG.CELL_TYPES.PATH;

            const directions = [
                { x: 2, y: 0 },
                { x: 0, y: 2 },
                { x: -2, y: 0 },
                { x: 0, y: -2 }
            ];

            // Shuffle directions
            for (let i = directions.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [directions[i], directions[j]] = [directions[j], directions[i]];
            }

            for (const dir of directions) {
                const nx = x + dir.x;
                const ny = y + dir.y;

                if (nx > 0 && nx < this.gridSize && ny > 0 && ny < this.gridSize && !visited[ny][nx]) {
                    maze[y + dir.y / 2][x + dir.x / 2] = CONFIG.CELL_TYPES.PATH;
                    carvePassage(nx, ny);
                }
            }
        };

        carvePassage(1, 1);

        // Step 2: Add random walls and obstacles to create complexity
        for (let y = 2; y < this.gridSize - 2; y++) {
            for (let x = 2; x < this.gridSize - 2; x++) {
                if (maze[y][x] === CONFIG.CELL_TYPES.PATH) {
                    // 40% chance to add strategic walls that block direct routes
                    if (Math.random() < 0.4) {
                        const wallDir = Math.floor(Math.random() * 4);
                        const wallPattern = [
                            { dx: 0, dy: -1 }, // up
                            { dx: 1, dy: 0 },  // right
                            { dx: 0, dy: 1 },  // down
                            { dx: -1, dy: 0 }  // left
                        ];
                        const wd = wallPattern[wallDir];
                        if (maze[y + wd.dy][x + wd.dx] === CONFIG.CELL_TYPES.PATH) {
                            if (Math.random() < 0.6) {
                                maze[y + wd.dy][x + wd.dx] = CONFIG.CELL_TYPES.WALL;
                            }
                        }
                    }
                }
            }
        }

        // Step 3: Create small rooms/chambers for more complexity
        for (let attempt = 0; attempt < Math.max(3, Math.floor(this.gridSize / 8)); attempt++) {
            const rx = Math.floor(Math.random() * (this.gridSize - 6)) + 3;
            const ry = Math.floor(Math.random() * (this.gridSize - 6)) + 3;
            const roomSize = 2 + Math.floor(Math.random() * 2);
            
            for (let dy = 0; dy <= roomSize; dy++) {
                for (let dx = 0; dx <= roomSize; dx++) {
                    if (ry + dy < this.gridSize - 1 && rx + dx < this.gridSize - 1) {
                        maze[ry + dy][rx + dx] = CONFIG.CELL_TYPES.PATH;
                    }
                }
            }
        }

        // Step 4: Add random corridors to connect areas
        for (let attempt = 0; attempt < Math.max(2, Math.floor(this.gridSize / 10)); attempt++) {
            let x = Math.floor(Math.random() * (this.gridSize - 2)) + 1;
            let y = Math.floor(Math.random() * (this.gridSize - 2)) + 1;
            const length = 3 + Math.floor(Math.random() * 4);
            const direction = Math.floor(Math.random() * 4);
            
            for (let i = 0; i < length; i++) {
                if (x > 0 && x < this.gridSize - 1 && y > 0 && y < this.gridSize - 1) {
                    maze[y][x] = CONFIG.CELL_TYPES.PATH;
                    if (direction === 0) x++; // right
                    else if (direction === 1) y++; // down
                    else if (direction === 2) x--; // left
                    else y--; // up
                }
            }
        }

        // Step 5: Add strategic dead-ends and loops
        for (let y = 2; y < this.gridSize - 2; y++) {
            for (let x = 2; x < this.gridSize - 2; x++) {
                if (maze[y][x] === CONFIG.CELL_TYPES.WALL && Math.random() < 0.05) {
                    maze[y][x] = CONFIG.CELL_TYPES.PATH; // Create random openings
                }
            }
        }

        // Ensure border is walls
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                if (x === 0 || y === 0 || x === this.gridSize - 1 || y === this.gridSize - 1) {
                    maze[y][x] = CONFIG.CELL_TYPES.WALL;
                }
            }
        }

        return maze;
    }

    placeStartAndGoal() {
        // Find all path cells
        const pathCells = [];
        for (let y = 1; y < this.gridSize - 1; y++) {
            for (let x = 1; x < this.gridSize - 1; x++) {
                if (this.maze[y][x] === CONFIG.CELL_TYPES.PATH) {
                    pathCells.push({ x, y });
                }
            }
        }

        if (pathCells.length < 2) {
            this.generateNewMaze();
            return;
        }

        // Place start at random path cell
        this.start = pathCells[Math.floor(Math.random() * pathCells.length)];
        this.maze[this.start.y][this.start.x] = CONFIG.CELL_TYPES.START;

        // Place goal at different path cell
        let goalIdx;
        do {
            goalIdx = Math.floor(Math.random() * pathCells.length);
        } while (pathCells[goalIdx] === this.start);

        this.goal = pathCells[goalIdx];
        this.maze[this.goal.y][this.goal.x] = CONFIG.CELL_TYPES.GOAL;
    }

    calculateOptimalPath() {
        this.optimalPath = this.aStar(this.start, this.goal);
    }

    /**
     * A* Algorithm Implementation
     */
    aStar(start, goal) {
        const openSet = new PriorityQueue();
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();

        const key = (pos) => `${pos.x},${pos.y}`;
        const heuristic = (pos) => Math.abs(pos.x - goal.x) + Math.abs(pos.y - goal.y);

        openSet.put(start, 0);
        gScore.set(key(start), 0);
        fScore.set(key(start), heuristic(start));

        while (!openSet.isEmpty()) {
            const current = openSet.get();

            if (current.x === goal.x && current.y === goal.y) {
                // Reconstruct path
                const path = [current];
                let curr = current;
                while (cameFrom.has(key(curr))) {
                    curr = cameFrom.get(key(curr));
                    path.unshift(curr);
                }
                return path;
            }

            // Check all neighbors (4-directional movement)
            const neighbors = this.getNeighbors(current);
            for (const neighbor of neighbors) {
                const tentativeGScore = gScore.get(key(current)) + 1;

                if (!gScore.has(key(neighbor)) || tentativeGScore < gScore.get(key(neighbor))) {
                    cameFrom.set(key(neighbor), current);
                    gScore.set(key(neighbor), tentativeGScore);
                    const fval = tentativeGScore + heuristic(neighbor);
                    fScore.set(key(neighbor), fval);

                    if (!openSet.contains(neighbor)) {
                        openSet.put(neighbor, fval);
                    }
                }
            }
        }

        return null; // No path found
    }

    getNeighbors(pos) {
        const neighbors = [];
        const directions = [
            { x: 0, y: -1 }, // up
            { x: 1, y: 0 },  // right
            { x: 0, y: 1 },  // down
            { x: -1, y: 0 }  // left
        ];

        for (const dir of directions) {
            const nx = pos.x + dir.x;
            const ny = pos.y + dir.y;

            if (nx >= 0 && nx < this.gridSize && ny >= 0 && ny < this.gridSize) {
                const cellType = this.maze[ny][nx];
                if (cellType !== CONFIG.CELL_TYPES.WALL) {
                    neighbors.push({ x: nx, y: ny });
                }
            }
        }

        return neighbors;
    }

    updateCanvasSize() {
        this.cellSize = Math.floor(600 / this.gridSize);
        this.canvas.width = this.gridSize * this.cellSize;
        this.canvas.height = this.gridSize * this.cellSize;
    }

    getCellFromMouse(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);

        if (cellX >= 0 && cellX < this.gridSize && cellY >= 0 && cellY < this.gridSize) {
            return { x: cellX, y: cellY };
        }
        return null;
    }

    startDrawing(e) {
        if (this.gameState !== 'playing') return;

        const cell = this.getCellFromMouse(e);
        if (!cell) return;

        // Check if starting from start node
        if (cell.x === this.start.x && cell.y === this.start.y) {
            this.isDrawing = true;
            this.userPath = [cell];
        }
    }

    draw(e) {
        if (!this.isDrawing || this.gameState !== 'playing') {
            this.redraw();
            return;
        }

        const cell = this.getCellFromMouse(e);
        if (!cell) {
            this.redraw();
            return;
        }

        const cellType = this.maze[cell.y][cell.x];

        // Only allow drawing on non-wall cells
        if (cellType === CONFIG.CELL_TYPES.WALL) {
            this.redraw();
            return;
        }

        // Check if adjacent to last cell in path
        if (this.userPath.length > 0) {
            const lastCell = this.userPath[this.userPath.length - 1];
            const distance = Math.abs(cell.x - lastCell.x) + Math.abs(cell.y - lastCell.y);

            if (distance !== 1) {
                this.redraw();
                return; // Not adjacent
            }

            // Avoid going backwards
            if (this.userPath.length > 1) {
                const prevCell = this.userPath[this.userPath.length - 2];
                if (cell.x === prevCell.x && cell.y === prevCell.y) {
                    this.userPath.pop();
                    this.redraw();
                    return;
                }
            }
        }

        // Add cell if not already in path
        const cellKey = `${cell.x},${cell.y}`;
        const pathKey = this.userPath.map(c => `${c.x},${c.y}`);
        if (!pathKey.includes(cellKey)) {
            this.userPath.push(cell);
        }

        // Enable submit button if path reaches goal
        if (cell.x === this.goal.x && cell.y === this.goal.y) {
            this.canSubmit = true;
            document.getElementById('submitBtn').disabled = false;
        }

        this.redraw();
    }

    stopDrawing() {
        this.isDrawing = false;
    }

    redraw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw maze
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const cellType = this.maze[y][x];
                const isUserPath = this.userPath.some(c => c.x === x && c.y === y);
                const isOptimalPath = this.optimalPath && this.optimalPath.some(c => c.x === x && c.y === y);

                // Determine color priority
                if (cellType === CONFIG.CELL_TYPES.WALL) {
                    this.drawCell(x, y, CONFIG.COLORS.WALL);
                } else if (cellType === CONFIG.CELL_TYPES.START) {
                    this.drawCell(x, y, CONFIG.COLORS.START);
                } else if (cellType === CONFIG.CELL_TYPES.GOAL) {
                    this.drawCell(x, y, CONFIG.COLORS.GOAL);
                } else if (isUserPath && isOptimalPath) {
                    this.drawCell(x, y, CONFIG.COLORS.USER_OPTIMAL_OVERLAP);
                } else if (this.gameState === 'submitted' && this.showOptimal && isOptimalPath) {
                    this.drawCell(x, y, CONFIG.COLORS.OPTIMAL_PATH);
                } else if (isUserPath) {
                    this.drawCell(x, y, CONFIG.COLORS.USER_PATH);
                } else {
                    this.drawCell(x, y, CONFIG.COLORS.PATH);
                }
            }
        }

        // Draw optimal path outline when showing (makes it more visible)
        if (this.gameState === 'submitted' && this.showOptimal && this.optimalPath) {
            for (let i = 0; i < this.optimalPath.length; i++) {
                const cell = this.optimalPath[i];
                this.ctx.strokeStyle = '#d4a017';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(cell.x * this.cellSize + 1, cell.y * this.cellSize + 1, this.cellSize - 2, this.cellSize - 2);
            }
        }

        // Draw start and goal on top
        if (this.start) {
            this.drawCell(this.start.x, this.start.y, CONFIG.COLORS.START);
            this.drawText(this.start.x, this.start.y, 'S', 'white');
        }
        if (this.goal) {
            this.drawCell(this.goal.x, this.goal.y, CONFIG.COLORS.GOAL);
            this.drawText(this.goal.x, this.goal.y, 'G', 'white');
        }
    }

    drawCell(x, y, color) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
        this.ctx.strokeStyle = '#bdc3c7';
        this.ctx.lineWidth = 0.5;
        this.ctx.strokeRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
    }

    drawText(x, y, text, color) {
        const centerX = (x + 0.5) * this.cellSize;
        const centerY = (y + 0.5) * this.cellSize;
        this.ctx.fillStyle = color;
        this.ctx.font = `bold ${Math.floor(this.cellSize * 0.5)}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(text, centerX, centerY);
    }

    resetUserPath() {
        this.userPath = [];
        this.canSubmit = false;
        this.showOptimal = false;
        document.getElementById('submitBtn').disabled = true;
        document.getElementById('showOptimalBtn').disabled = true;
        document.getElementById('showOptimalBtn').textContent = '👁️ Show Optimal Path';
        this.clearStats();
        this.clearStatus();
        this.redraw();
    }

    submitPath() {
        if (!this.canSubmit) {
            this.showStatus('Please complete a path from start to goal!', 'error');
            return;
        }

        if (!this.isValidPath()) {
            this.showStatus('Invalid path! Make sure it goes from start to goal.', 'error');
            return;
        }

        this.gameState = 'submitted';
        this.showOptimal = true; // Auto-show optimal path after submission
        document.getElementById('showOptimalBtn').disabled = false;

        if (!this.optimalPath) {
            this.showStatus('❌ No solution exists for this maze!', 'error');
        } else {
            this.calculateScore();
            this.redraw();
        }
    }

    toggleOptimalPath() {
        this.showOptimal = !this.showOptimal;
        const btn = document.getElementById('showOptimalBtn');
        btn.textContent = this.showOptimal ? '👁️ Hide Optimal Path' : '👁️ Show Optimal Path';
        this.redraw();
    }

    isValidPath() {
        if (this.userPath.length < 2) return false;

        const start = this.userPath[0];
        const end = this.userPath[this.userPath.length - 1];

        return start.x === this.start.x && start.y === this.start.y &&
               end.x === this.goal.x && end.y === this.goal.y;
    }

    calculateScore() {
        const userLength = this.userPath.length;
        const optimalLength = this.optimalPath.length;
        const score = Math.round((optimalLength / userLength) * 100);

        document.getElementById('userPathLength').textContent = userLength;
        document.getElementById('optimalPathLength').textContent = optimalLength;
        document.getElementById('score').textContent = `${score}%`;

        let message = '';
        if (score === 100) {
            message = `🎯 Perfect! You found the optimal path (shown in yellow)! Score: ${score}%`;
        } else if (score >= 80) {
            message = `✨ Excellent solution! Optimal path shown in yellow. Score: ${score}%`;
        } else if (score >= 60) {
            message = `👍 Good job! Optimal path shown in yellow. Score: ${score}%`;
        } else if (score >= 40) {
            message = `📊 Room for improvement! Optimal path shown in yellow. Score: ${score}%`;
        } else {
            message = `💪 Keep practicing! Optimal path shown in yellow. Score: ${score}%`;
        }

        this.showStatus(message, 'success');
    }

    showStatus(message, type = 'info') {
        const statusEl = document.getElementById('status-message');
        statusEl.textContent = message;
        statusEl.className = `status-message ${type}`;
    }

    clearStatus() {
        document.getElementById('status-message').textContent = '';
        document.getElementById('status-message').className = 'status-message';
    }

    clearStats() {
        document.getElementById('userPathLength').textContent = '-';
        document.getElementById('optimalPathLength').textContent = '-';
        document.getElementById('score').textContent = '-';
    }
}

/**
 * Priority Queue for A* Algorithm
 */
class PriorityQueue {
    constructor() {
        this.items = [];
    }

    put(item, priority) {
        const newItem = { item, priority };
        let added = false;

        for (let i = 0; i < this.items.length; i++) {
            if (newItem.priority < this.items[i].priority) {
                this.items.splice(i, 0, newItem);
                added = true;
                break;
            }
        }

        if (!added) {
            this.items.push(newItem);
        }
    }

    get() {
        return this.items.shift()?.item;
    }

    contains(item) {
        return this.items.some(elem => 
            elem.item.x === item.x && elem.item.y === item.y
        );
    }

    isEmpty() {
        return this.items.length === 0;
    }
}

// Initialize game when page loads
window.addEventListener('DOMContentLoaded', () => {
    window.game = new MazeGame();
    window.game.generateNewMaze(); // Auto-generate first maze
    console.log('🎮 Maze Game initialized!');
});
