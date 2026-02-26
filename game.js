/**
 * Finger 67: Tactical Duel
 * Lógica de Jogo e Interface (HUD)
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const gameOverScreen = document.getElementById('game-over');
const winnerText = document.getElementById('winner-text');
const messageCenter = document.getElementById('message-center');

// Configurações do Canvas
const GAME_WIDTH = 960;
const GAME_HEIGHT = 600;
canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;

// Constantes de Jogo
const PLAYER_SIZE = 40;
const BULLET_RADIUS = 5;
const PLAYER_SPEED = 5;
const BULLET_SPEED = 10;
const INITIAL_LIVES = 5;
const MAX_AMMO = 5;

// Estado do Jogo
let gameActive = false;
let player1, player2;
let bullets = [];
let ammoBoxes = [];
let keys = {};

// Cores Neon
const COLORS = {
    p1: '#00f7ff', // Ciano
    p2: '#ff00ff', // Rosa
    bullet: '#ffffff',
    ammo: '#00ff00',
    bg: '#0a0a0c'
};

/**
 * Inicializa os jogadores
 */
function resetPlayers() {
    player1 = {
        id: 1,
        x: 100,
        y: GAME_HEIGHT / 2 - PLAYER_SIZE / 2,
        width: PLAYER_SIZE,
        height: PLAYER_SIZE,
        vida: player1 ? player1.vida : INITIAL_LIVES,
        balas: MAX_AMMO,
        color: COLORS.p1,
        dir: 1 // 1 para direita, -1 para esquerda
    };

    player2 = {
        id: 2,
        x: GAME_WIDTH - 100 - PLAYER_SIZE,
        y: GAME_HEIGHT / 2 - PLAYER_SIZE / 2,
        width: PLAYER_SIZE,
        height: PLAYER_SIZE,
        vida: player2 ? player2.vida : INITIAL_LIVES,
        balas: MAX_AMMO,
        color: COLORS.p2,
        dir: -1
    };

    bullets = [];
    ammoBoxes = [];
    spawnAmmo(); // Garante que há munição no chão
}

/**
 * Gera uma caixa de munição no centro
 */
function spawnAmmo() {
    const margin = 150;
    ammoBoxes = [{
        x: margin + Math.random() * (GAME_WIDTH - 2 * margin),
        y: margin + Math.random() * (GAME_HEIGHT - 2 * margin),
        size: 20
    }];
}

/**
 * Inicia o Jogo
 */
function startGame() {
    player1 = null;
    player2 = null;
    resetPlayers();
    player1.vida = INITIAL_LIVES;
    player2.vida = INITIAL_LIVES;
    gameActive = true;
    overlay.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    requestAnimationFrame(gameLoop);
}

/**
 * Finaliza o Jogo
 */
function endGame(winner) {
    gameActive = false;
    overlay.classList.remove('hidden');
    gameOverScreen.classList.remove('hidden');
    startBtn.classList.add('hidden');
    winnerText.innerText = winner === 1 ? "P1 VENCEU!" : "P2 VENCEU!";
    winnerText.style.textShadow = `0 0 20px ${winner === 1 ? COLORS.p1 : COLORS.p2}`;
}

// Event Listeners
window.addEventListener('keydown', (e) => keys[e.code] = true);
window.addEventListener('keyup', (e) => keys[e.code] = false);

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

/**
 * Lógica do TIRO
 */
function shoot(player) {
    if (player.balas > 0) {
        bullets.push({
            x: player.dir === 1 ? player.x + player.width + BULLET_RADIUS : player.x - BULLET_RADIUS,
            y: player.y + player.height / 2,
            vx: player.dir * BULLET_SPEED,
            owner: player.id
        });
        player.balas--;
    }
}

/**
 * Atualização do Estado
 */
function update() {
    if (!gameActive) return;

    // Movimento Player 1
    if (keys['KeyW'] && player1.y > 50) player1.y -= PLAYER_SPEED;
    if (keys['KeyS'] && player1.y < GAME_HEIGHT - player1.height) player1.y += PLAYER_SPEED;
    if (keys['KeyA'] && player1.x > 0) player1.x -= PLAYER_SPEED;
    if (keys['KeyD'] && player1.x < GAME_WIDTH / 2 - player1.width) player1.x += PLAYER_SPEED;

    // Movimento Player 2
    if (keys['ArrowUp'] && player2.y > 50) player2.y -= PLAYER_SPEED;
    if (keys['ArrowDown'] && player2.y < GAME_HEIGHT - player2.height) player2.y += PLAYER_SPEED;
    if (keys['ArrowLeft'] && player2.x > GAME_WIDTH / 2) player2.x -= PLAYER_SPEED;
    if (keys['ArrowRight'] && player2.x < GAME_WIDTH - player2.width) player2.x += PLAYER_SPEED;

    // Atirar
    if (keys['Space']) {
        shoot(player1);
        keys['Space'] = false; // Evita tiro contínuo
    }
    if (keys['Enter']) {
        shoot(player2);
        keys['Enter'] = false;
    }

    // Balas
    bullets.forEach((bullet, index) => {
        bullet.x += bullet.vx;

        // Colisão com paredes
        if (bullet.x < 0 || bullet.x > GAME_WIDTH) {
            bullets.splice(index, 1);
            return;
        }

        // Colisão com Jogadores
        const p1Hit = bullet.owner === 2 &&
            bullet.x > player1.x && bullet.x < player1.x + player1.width &&
            bullet.y > player1.y && bullet.y < player1.y + player1.height;

        const p2Hit = bullet.owner === 1 &&
            bullet.x > player2.x && bullet.x < player2.x + player2.width &&
            bullet.y > player2.y && bullet.y < player2.y + player2.height;

        if (p1Hit) {
            player1.vida--;
            if (player1.vida <= 0) endGame(2);
            else resetPlayers();
        } else if (p2Hit) {
            player2.vida--;
            if (player2.vida <= 0) endGame(1);
            else resetPlayers();
        }
    });

    // Colisão com Munição
    ammoBoxes.forEach((box, index) => {
        const p1Col = Math.abs(player1.x + player1.width / 2 - box.x) < 30 &&
            Math.abs(player1.y + player1.height / 2 - box.y) < 30;
        const p2Col = Math.abs(player2.x + player2.width / 2 - box.x) < 30 &&
            Math.abs(player2.y + player2.height / 2 - box.y) < 30;

        if (p1Col) {
            player1.balas = MAX_AMMO;
            ammoBoxes.splice(index, 1);
            setTimeout(spawnAmmo, 2000);
        } else if (p2Col) {
            player2.balas = MAX_AMMO;
            ammoBoxes.splice(index, 1);
            setTimeout(spawnAmmo, 2000);
        }
    });
}

/**
 * Renderização Principal (HUD e Jogo)
 */
function draw() {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    if (!gameActive) return;

    // Desenha HUD P1
    drawHUD(player1, 20, 30, 'left');

    // Desenha HUD P2
    drawHUD(player2, GAME_WIDTH - 20, 30, 'right');

    // Alerta de Recarregue
    if (player1.balas === 0 || player2.balas === 0) {
        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 20px Orbitron';
        ctx.textAlign = 'center';
        if (Date.now() % 1000 < 500) {
            ctx.fillText('BUSQUE MUNIÇÃO NO CHÃO!', GAME_WIDTH / 2, 40);
        }
    }

    // Desenha Jogadores (Minimalistas Neon)
    drawPlayer(player1);
    drawPlayer(player2);

    // Desenha Divisória
    ctx.setLineDash([10, 10]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.moveTo(GAME_WIDTH / 2, 60);
    ctx.lineTo(GAME_WIDTH / 2, GAME_HEIGHT - 20);
    ctx.stroke();
    ctx.setLineDash([]);

    // Desenha Balas
    bullets.forEach(bullet => {
        ctx.fillStyle = COLORS.bullet;
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, BULLET_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        // Glow impactante
        ctx.shadowBlur = 10;
        ctx.shadowColor = COLORS.bullet;
    });
    ctx.shadowBlur = 0;

    // Desenha Caixa de Munição
    ammoBoxes.forEach(box => {
        ctx.fillStyle = COLORS.ammo;
        ctx.fillRect(box.x - box.size / 2, box.y - box.size / 2, box.size, box.size);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(box.x - box.size / 2, box.y - box.size / 2, box.size, box.size);
        ctx.font = 'bold 12px Orbitron';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText('📥', box.x, box.y + 5);
    });
}

/**
 * Desenha o Jogador como um retângulo neon
 */
function drawPlayer(p) {
    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = p.color;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.width, p.height);

    // Indica direção (Olho/Frente)
    ctx.fillStyle = '#000';
    if (p.dir === 1) ctx.fillRect(p.x + p.width - 5, p.y + 10, 5, 20);
    else ctx.fillRect(p.x, p.y + 10, 5, 20);

    ctx.restore();
}

/**
 * Desenha o HUD (Vidas e Balas)
 */
function drawHUD(player, x, y, align) {
    ctx.font = 'bold 18px Orbitron';
    ctx.fillStyle = player.color;
    ctx.textAlign = align;

    const label = `JOGADOR ${player.id}`;
    const heartIcon = '❤️';
    const ammoIcon = '📥';

    // Vidas
    let livesStr = '';
    for (let i = 0; i < INITIAL_LIVES; i++) {
        livesStr += i < player.vida ? heartIcon : '🖤';
    }

    // Desenho
    if (align === 'left') {
        ctx.fillText(label, x, y);
        ctx.font = '16px Inter';
        ctx.fillText(livesStr, x, y + 25);
        ctx.fillStyle = player.balas === 0 ? '#ff4444' : '#fff';
        ctx.fillText(`${ammoIcon} ${player.balas}/${MAX_AMMO}`, x, y + 50);
    } else {
        ctx.fillText(label, x, y);
        ctx.font = '16px Inter';
        ctx.fillText(livesStr, x, y + 25);
        ctx.fillStyle = player.balas === 0 ? '#ff4444' : '#fff';
        ctx.fillText(`${player.balas}/${MAX_AMMO} ${ammoIcon}`, x, y + 50);
    }
}

/**
 * Loop do Jogo
 */
function gameLoop() {
    update();
    draw();
    if (gameActive) requestAnimationFrame(gameLoop);
}

// Inicializa estado visual
ctx.fillStyle = 'white';
ctx.font = '20px Orbitron';
ctx.textAlign = 'center';
ctx.fillText('AGUARDANDO INÍCIO...', GAME_WIDTH / 2, GAME_HEIGHT / 2);
