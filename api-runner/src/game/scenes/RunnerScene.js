import { Scene } from 'phaser';

// Threat types for API security teaching (OWASP API Security)
const THREAT_TYPES = [
    {
        id: 'bot',
        label: 'BOT',
        failMessage: 'Automated attack detected - Bot mitigation failed',
        color: 0xff4444,
        width: 30,
        height: 60
    },
    {
        id: 'bola',
        label: 'BOLA',
        failMessage: 'Broken Object Level Authorization - Data breach occurred',
        color: 0xff0066,
        width: 40,
        height: 55
    },
    {
        id: 'broken_auth',
        label: 'Broken-Auth',
        failMessage: 'Broken Authentication - Identity compromise detected',
        color: 0xff8800,
        width: 35,
        height: 50
    },
    {
        id: 'shadow_apis',
        label: 'ShadowAPIs',
        failMessage: 'Shadow API exposed - Undocumented endpoint discovered',
        color: 0x8844ff,
        width: 25,
        height: 70
    },
    {
        id: 'bfla',
        label: 'BFLA',
        failMessage: 'Broken Function Level Authorization - Privilege escalation detected',
        color: 0x44aaff,
        width: 35,
        height: 55
    },
    {
        id: 'bad_trust',
        label: 'BadTrust',
        failMessage: 'Improper Trust Boundary - Security boundary violated',
        color: 0xaa44ff,
        width: 30,
        height: 60
    }
];

// Map threat IDs to icon texture keys
const ICON_MAP = {
    'bot': 'icon_bot',
    'bola': 'icon_bola',
    'broken_auth': 'icon_broken_auth',
    'shadow_apis': 'icon_shadow_apis',
    'bfla': 'icon_bfla',
    'bad_trust': 'icon_bad_trust'
};

// Player dimensions
const PLAYER_WIDTH = 50;
const PLAYER_HEIGHT = 70;
const PLAYER_VISUAL_LIFT_PX = 8; // Lift visual sprite above physics body for better appearance

// Runner shadow settings
const RUNNER_SHADOW_WIDTH_GROUNDED = 36;
const RUNNER_SHADOW_WIDTH_AIRBORNE = 24;
const RUNNER_SHADOW_HEIGHT = 8;
const RUNNER_SHADOW_ALPHA = 0.15;

// Landing bounce settings
const LANDING_BOUNCE_PX = 3;
const LANDING_BOUNCE_DURATION = 140; // ms total (down + up)

// Character sprites mapping
const CHARACTER_SPRITES = {
    'suit': '/icons/SuitRuner.png',
    'hack': '/icons/hackRunner.png',
    'nyan': '/icons/NyanRunner.png'
};

export class RunnerScene extends Scene {
    constructor() {
        super('RunnerScene');
        // Track which icons loaded successfully
        this.loadedIcons = new Set();
    }

    preload() {
        // Load background image
        this.load.image('bg_clouds', '/icons/Cloudbackground.png');

        // Load game logo for HUD
        this.load.svg('game_logo', '/icons/F5GameLogo.svg', { width: 240, height: 240 });

        // Get selected character from localStorage
        let characterId = localStorage.getItem('apiRunner.characterId') || 'suit';

        // Validate nyan is unlocked this session, fall back to suit if not
        if (characterId === 'nyan' && sessionStorage.getItem('apiRunner.nyanUnlocked') !== 'true') {
            characterId = 'suit';
        }

        // Get sprite path for selected character
        const spritePath = CHARACTER_SPRITES[characterId] || CHARACTER_SPRITES['suit'];

        // Load player sprite
        this.load.image('player_runner', spritePath);

        // Define all icons to load: [textureKey, filePath, type]
        const iconsToLoad = [
            ['icon_bot', '/icons/bot.svg', 'svg'],
            ['icon_bola', '/icons/BOLA.svg', 'svg'],
            ['icon_broken_auth', '/icons/Broken-Auth.svg', 'svg'],
            ['icon_shadow_apis', '/icons/ShadowAPIs.svg', 'svg'],
            ['icon_bfla', '/icons/BLFA.svg', 'svg'],
            ['icon_bad_trust', '/icons/BadTrust.svg', 'svg']
        ];

        // Load each icon
        iconsToLoad.forEach(([key, path, type]) => {
            if (type === 'svg') {
                this.load.svg(key, path, { width: 64, height: 64 });
            } else {
                this.load.image(key, path);
            }
        });

        // Track successful loads
        this.load.on('filecomplete', (key) => {
            if (key.startsWith('icon_')) {
                console.log(`Icon loaded: ${key}`);
                this.loadedIcons.add(key);
            }
        });

        // Track load failures
        this.load.on('loaderror', (file) => {
            if (file.key.startsWith('icon_')) {
                console.warn(`Failed to load icon: ${file.key} from ${file.url} - will fall back to rectangle`);
            }
        });
    }

    create() {
        console.log('create() ran in RunnerScene');

        const { width, height } = this.scale;

        // Get player info from localStorage
        this.nickname = localStorage.getItem('apiRunner.nickname') || 'Anonymous';
        this.eventId = localStorage.getItem('apiRunner.eventId') || 'F5-API-SEC';

        // Game state
        this.score = 0;
        this.isGameOver = false;

        // Track obstacles in an array
        this.obstacles = [];

        // Solid white background behind everything
        this.add.rectangle(width / 2, height / 2, width, height, 0xffffff).setDepth(-10);

        // Cloud overlay (semi-transparent, above obstacles but below labels/UI)
        const clouds = this.add.image(0, 0, 'bg_clouds');
        clouds.setOrigin(0, 0);
        clouds.setDisplaySize(width, height);
        clouds.setDepth(55); // Above obstacles (50) but below labels (100) and UI (1000)
        clouds.setAlpha(0.18);
        clouds.setTint(0xffffff); // White tint for lighter/airier feel
        clouds.setScrollFactor(0); // Fixed position

        // Game logo HUD (top-left, fixed to camera, above clouds and UI)
        // Responsive: 120px on normal screens, 90px on small (width <= 400)
        const logoWidth = width <= 400 ? 90 : 120;
        this.gameLogo = this.add.image(12, 12, 'game_logo');
        this.gameLogo.setOrigin(0, 0);
        this.gameLogo.setDisplaySize(logoWidth, logoWidth); // SVG is square, height auto-scales
        this.gameLogo.setDepth(1001); // Above all UI elements
        this.gameLogo.setScrollFactor(0); // Fixed to camera

        // Ground - positioned at bottom
        this.ground = this.add.rectangle(width / 2, height - 30, width, 60, 0x2d2d44);
        this.physics.add.existing(this.ground, true);

        // Ground top position using getBounds() for reliable placement
        this.groundTopY = this.ground.getBounds().top;
        console.log('Ground top Y (getBounds):', this.groundTopY);

        // Ground baseline at exact ground level (darker for visibility)
        this.add.rectangle(width / 2, this.groundTopY + 1, width, 3, 0x999999).setDepth(5);

        // Player physics body (invisible rectangle for collisions)
        const bodyWidth = Math.floor(PLAYER_WIDTH * 0.45);
        const bodyHeight = Math.floor(PLAYER_HEIGHT * 0.70);

        // Create invisible physics body positioned with bottom at groundTopY
        this.playerBody = this.add.rectangle(120, this.groundTopY - bodyHeight / 2, bodyWidth, bodyHeight);
        this.playerBody.setVisible(false); // Invisible - only for physics
        this.physics.add.existing(this.playerBody);
        this.playerBody.body.setCollideWorldBounds(true);
        this.playerBody.body.setGravityY(800);

        // Player shadow (visual only, on ground)
        this.playerShadow = this.add.ellipse(
            120,
            this.groundTopY + 2,
            RUNNER_SHADOW_WIDTH_GROUNDED,
            RUNNER_SHADOW_HEIGHT,
            0x000000,
            RUNNER_SHADOW_ALPHA
        );
        this.playerShadow.setDepth(4); // Below player and ground line

        // Player visual sprite (non-physics, follows body with lift)
        this.playerSprite = this.add.image(120, this.groundTopY - PLAYER_VISUAL_LIFT_PX, 'player_runner');
        this.playerSprite.setOrigin(0.5, 1); // Bottom-center origin
        this.playerSprite.setDisplaySize(PLAYER_WIDTH, PLAYER_HEIGHT);
        this.playerSprite.setDepth(10);

        // Landing state tracking
        this.wasGrounded = true;
        this.landingBounceOffset = 0;
        this.isLandingBouncing = false;

        // Alias for collision detection (obstacles collide with playerBody)
        this.player = this.playerBody;

        // Collide player body with ground
        this.physics.add.collider(this.playerBody, this.ground);

        // Score text (top-left) - dark for white background
        this.scoreText = this.add.text(20, 20, 'Score: 0', {
            fontSize: '28px',
            fontFamily: 'Arial, sans-serif',
            color: '#333333'
        }).setDepth(1000);

        // Player info display (bottom-left)
        this.infoText = this.add.text(20, height - 20, `Event: ${this.eventId} | ${this.nickname}`, {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            color: 'rgba(0,0,0,0.5)'
        }).setOrigin(0, 1).setDepth(1000);

        // Jump input (tap/click) - mobile friendly
        this.input.on('pointerdown', this.jump, this);

        // Keyboard jump (spacebar)
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // Score timer - +1 every 100ms
        this.scoreTimer = this.time.addEvent({
            delay: 100,
            callback: this.incrementScore,
            callbackScope: this,
            loop: true
        });

        // Schedule first obstacle spawn
        this.scheduleNextSpawn();

        console.log('RunnerScene fully initialized');
    }

    scheduleNextSpawn() {
        if (this.isGameOver) return;

        // Random delay between 700ms and 1600ms
        const delay = Phaser.Math.Between(700, 1600);

        this.spawnTimer = this.time.delayedCall(delay, () => {
            this.spawnObstacle();
            this.scheduleNextSpawn(); // Recursive scheduling
        });
    }

    update() {
        if (this.isGameOver) return;

        // Keyboard jump
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            this.jump();
        }

        // Check if player is grounded
        const isGrounded = this.playerBody.body.blocked.down || this.playerBody.body.touching.down;

        // Detect landing (transition from airborne to grounded)
        if (isGrounded && !this.wasGrounded && !this.isLandingBouncing) {
            this.triggerLandingBounce();
        }
        this.wasGrounded = isGrounded;

        // Sync visual sprite to physics body (with visual lift + landing bounce)
        const bodyBottom = this.playerBody.body.y + this.playerBody.body.height;
        this.playerSprite.x = this.playerBody.x;
        this.playerSprite.y = bodyBottom - PLAYER_VISUAL_LIFT_PX + this.landingBounceOffset;

        // Update runner shadow position and size
        this.playerShadow.x = this.playerBody.x;
        const shadowWidth = isGrounded ? RUNNER_SHADOW_WIDTH_GROUNDED : RUNNER_SHADOW_WIDTH_AIRBORNE;
        this.playerShadow.setSize(shadowWidth, RUNNER_SHADOW_HEIGHT);

        // Update label and shadow positions, clean up off-screen obstacles
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obstacle = this.obstacles[i];

            // Update label position to follow obstacle
            if (obstacle.label && obstacle.label.active) {
                const offsetY = obstacle.labelOffsetY !== undefined ? obstacle.labelOffsetY : -45;
                obstacle.label.setPosition(obstacle.x, obstacle.y + offsetY);
            }

            // Update shadow position to follow obstacle (LOW obstacles only)
            if (obstacle.shadow && obstacle.shadow.active) {
                obstacle.shadow.setPosition(obstacle.x, this.groundTopY + 2);
            }

            // Clean up off-screen obstacles, labels, and shadows
            if (obstacle.x < -100) {
                if (obstacle.label) {
                    obstacle.label.destroy();
                }
                if (obstacle.shadow) {
                    obstacle.shadow.destroy();
                }
                obstacle.destroy();
                this.obstacles.splice(i, 1);
            }
        }
    }

    jump() {
        if (this.isGameOver) return;

        // Only jump if on the ground
        if (this.player.body.touching.down || this.player.body.blocked.down) {
            this.player.body.setVelocityY(-500);
        }
    }

    triggerLandingBounce() {
        if (this.isGameOver) return;

        this.isLandingBouncing = true;
        const halfDuration = LANDING_BOUNCE_DURATION / 2;

        // Bounce down
        this.tweens.add({
            targets: this,
            landingBounceOffset: LANDING_BOUNCE_PX,
            duration: halfDuration,
            ease: 'Quad.easeOut',
            onComplete: () => {
                // Bounce back up
                this.tweens.add({
                    targets: this,
                    landingBounceOffset: 0,
                    duration: halfDuration,
                    ease: 'Quad.easeIn',
                    onComplete: () => {
                        this.isLandingBouncing = false;
                    }
                });
            }
        });
    }

    incrementScore() {
        if (this.isGameOver) return;
        this.score += 1;
        this.scoreText.setText('Score: ' + this.score);
    }

    spawnObstacle() {
        if (this.isGameOver) return;

        // Pick random threat type
        const threat = Phaser.Math.RND.pick(THREAT_TYPES);

        // Determine obstacle height type: 70% LOW, 30% HIGH
        const isHigh = Math.random() < 0.3;
        const obstacleType = isHigh ? 'HIGH' : 'LOW';

        // Spawn position
        const x = this.scale.width + 60;

        let obstacle;
        let y;

        // Check if this threat has an icon and it loaded successfully
        const iconKey = ICON_MAP[threat.id];
        const hasIcon = iconKey && this.loadedIcons.has(iconKey);

        const iconSize = 60;

        if (isHigh) {
            // HIGH obstacle: positioned above the player so they can run under
            // Player top is at groundTopY - PLAYER_HEIGHT
            // Position obstacle so its bottom edge is above player head with clearance
            y = this.groundTopY - PLAYER_HEIGHT - iconSize - 5; // 5px clearance above player
        } else {
            // LOW obstacle: sits on ground
            y = this.groundTopY - (iconSize / 2);
        }

        if (hasIcon) {
            // Use icon for this threat
            obstacle = this.physics.add.image(x, y, iconKey);
            obstacle.setDisplaySize(iconSize, iconSize);
            obstacle.body.setAllowGravity(false);
            obstacle.setImmovable(true);
            obstacle.setVelocityX(-250);
            obstacle.setDepth(50);

            // Store threat info
            obstacle.threat = threat;
            obstacle.obstacleType = obstacleType;
        } else {
            // Fallback to colored rectangle
            const w = threat.width;
            const h = threat.height;

            if (isHigh) {
                y = this.groundTopY - PLAYER_HEIGHT - h - 5;
            } else {
                y = this.groundTopY - (h / 2);
            }

            obstacle = this.add.rectangle(x, y, w, h, threat.color);
            obstacle.setDepth(50);

            // Store threat info on the obstacle
            obstacle.threat = threat;
            obstacle.obstacleType = obstacleType;

            // Attach Arcade physics
            this.physics.add.existing(obstacle);
            const body = obstacle.body;
            body.setAllowGravity(false);
            body.setImmovable(true);
            body.setVelocityX(-250);
            body.setSize(w, h);

            // Log fallback usage
            console.warn(`Using rectangle fallback for threat: ${threat.id}`);
        }

        // Add collider - HIGH obstacles are positioned above player, so collision
        // only happens if player jumps into them
        this.physics.add.collider(this.player, obstacle, () => this.gameOver(obstacle), null, this);

        // Create label above obstacle
        const labelY = isHigh ? y - 40 : y - 45;
        const label = this.add.text(obstacle.x, labelY, threat.label, {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#333333',
            backgroundColor: 'rgba(255,255,255,0.85)',
            padding: { x: 6, y: 3 }
        }).setOrigin(0.5).setDepth(100);

        // Store label reference and offset for proper following
        obstacle.label = label;
        obstacle.labelOffsetY = labelY - y;

        // Add ground shadow for LOW obstacles only (helps players see what's grounded)
        if (!isHigh) {
            const shadow = this.add.ellipse(x, this.groundTopY + 2, 40, 8, 0x000000, 0.12);
            shadow.setDepth(4); // Below ground line
            obstacle.shadow = shadow;
        }

        // Track in array
        this.obstacles.push(obstacle);

        console.log('Spawned threat:', threat.id, obstacleType, hasIcon ? '(icon)' : '(rect)');
    }

    gameOver(hitObstacle) {
        if (this.isGameOver) return;

        console.log('COLLISION - Game Over!');

        this.isGameOver = true;

        // Get fail message from the obstacle that was hit
        const failMessage = hitObstacle?.threat?.failMessage || 'API Security breach detected';

        // Stop timers
        if (this.scoreTimer) this.scoreTimer.remove();
        if (this.spawnTimer) this.spawnTimer.remove();

        // Reset landing bounce state
        this.tweens.killTweensOf(this);
        this.landingBounceOffset = 0;
        this.isLandingBouncing = false;

        // Stop player
        this.player.body.setVelocity(0, 0);
        this.player.body.setAllowGravity(false);

        // Stop all obstacles
        this.obstacles.forEach(rect => {
            if (rect.body) {
                rect.body.setVelocity(0, 0);
            }
        });

        // Flash player red (tint for visual sprite)
        this.playerSprite.setTint(0xff0000);

        // Emit game over event with threat-specific message
        this.time.delayedCall(500, () => {
            this.game.events.emit('gameOver', {
                score: this.score,
                message: failMessage
            });
        });
    }
}
