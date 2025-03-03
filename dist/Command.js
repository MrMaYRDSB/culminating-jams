import { Game } from "./Game.js";
import { update, ref, set,
//@ts-ignore Import module
 } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { FirebaseClient } from "./FirebaseClient.js";
import { Canvas } from "./Canvas.js";
import { VectorMath } from "./Vector.js";
import { GameMap } from "./Map.js";
import { PIXEL_COLORS } from "./Map.js";
import { Utilities } from "./Utilities.js";
import { Bullet } from "./Bullet.js";
/**
 * General class for handling mouse click events
 */
class HandleMouseClickCommand {
    mousePositionX = 0;
    mousePositionY = 0;
    rightClick = false;
    /**
     *
     * @param type the type of mouse click (2 is right click, 0 is left click)
     * @returns itself
     */
    assignType(type) {
        if (type === 2) {
            this.rightClick = true;
        }
        return this;
    }
    // either do this or get the coordinates directly from controller in the execute
    // (if having an extra method in commands are not allowed)
    assignCoordinates(x, y) {
        this.mousePositionX = x;
        this.mousePositionY = y;
        return this;
    }
}
/**
 * Shoots bullets if right click, toggles laser if left click
 */
class MainGameMouseClickedEventHandlerCommand extends HandleMouseClickCommand {
    execute() {
        if (this.rightClick) {
            new ShootBulletCommand(Game.instance.player).execute();
            this.rightClick = false;
        }
        else {
            new ToggleLaserCommand().execute();
        }
    }
}
class MenuMouseClickedEventHandlerCommand extends HandleMouseClickCommand {
    menu;
    constructor(menu) {
        super();
        this.menu = menu;
    }
    execute() {
        for (let button of this.menu.buttons) {
            if (button.checkCoordinatesOnButton(this.mousePositionX, this.mousePositionY)) {
                button.executeCommand();
                break;
            }
        }
    }
}
/**
 * Lock the pointer, start the game, and set the controls for the game
 */
class StartGameCommand {
    execute() {
        Canvas.instance.screen.requestPointerLock();
        Game.instance.startGame();
        new SetMainGameControlsCommand().execute();
        Game.instance.controller.assignEscKeyPressedCommand(new MainGameEscapeKeyPressedCommand());
        Game.instance.controller.assignPointerLockChangeCommand(new TogglePauseCommand());
    }
}
/**
 * Unset the controls for the game and end the game
 */
class ExitGameCommand {
    execute() {
        Game.instance.endGame();
        new UnsetMainGameControlsCommand().execute();
    }
}
// got to here with UML
class ExitGameThenDisplayMenuCommand extends ExitGameCommand {
    menu;
    constructor(menu) {
        super();
        this.menu = menu;
    }
    execute() {
        super.execute();
        new DisplayMenuAndSetMouseControllerCommand(this.menu).execute();
    }
}
/**
 * shoot a bullet from the given player's position
 */
class ShootBulletCommand {
    player;
    constructor(player) {
        this.player = player;
    }
    execute() {
        if (this.player.canShoot) {
            Game.instance.player.ammoGauge.useFuel(Bullet.fuelCost);
            const NEW_BULLET = new Bullet(this.player);
            new UploadBulletToFirebaseCommand(NEW_BULLET).execute();
            Game.instance.bulletsBySelf.push(NEW_BULLET);
            this.player.resetShootingCooldown();
        }
    }
}
/**
 * display a paragraph of text at the given x and y positions with width "maxWidth"
 */
class DisplayTextCommand {
    text;
    x;
    y;
    maxWidth;
    constructor(text, x, y, maxWidth) {
        this.text = text;
        this.x = x;
        this.y = y;
        this.maxWidth = maxWidth;
    }
    execute() {
        // modified code from StackOverflow to autowrap texts in canvas
        let fontSize = 16;
        let fontFace = "Arial";
        let words = this.text.split(' ');
        let line = '';
        let lineHeight = fontSize;
        Canvas.instance.context.fillStyle = "black";
        Canvas.instance.context.font = fontSize + "px " + fontFace;
        for (let n = 0; n < words.length; n++) {
            let testLine = line + words[n] + ' ';
            let metrics = Canvas.instance.context.measureText(testLine);
            let testWidth = metrics.width;
            if (testWidth > this.maxWidth) {
                Canvas.instance.context.fillText(line, this.x, this.y);
                line = words[n] + ' ';
                this.y += lineHeight;
            }
            else {
                line = testLine;
            }
        }
        Canvas.instance.context.fillText(line, this.x, this.y);
    }
}
/**
 * Render the view from the player's current position and perspective
 */
class RenderViewForPlayerCommand {
    execute() {
        Canvas.instance.context.clearRect(0, 0, Canvas.WIDTH, Canvas.HEIGHT);
        const ADJACENT_LENGTH_MAGNITUDE = (Canvas.WIDTH / 2) / Math.tan(Game.instance.player.fov / 2);
        const PLAYER_TO_VIEWPORT_CENTER_UNIT_VECTOR = VectorMath.convertYawAndPitchToUnitVector([Game.instance.player.yaw, Game.instance.player.pitch]);
        const PLAYER_TO_VIEWPORT_CENTER_VECTOR = VectorMath.convertUnitVectorToVector(PLAYER_TO_VIEWPORT_CENTER_UNIT_VECTOR, ADJACENT_LENGTH_MAGNITUDE);
        // 1 unit vector from the left of the view port to the right
        const PLAYER_VIEWPORT_HORIZONTAL_UNIT_VECTOR = VectorMath.convertYawAndPitchToUnitVector([Game.instance.player.yaw + Math.PI / 2, 0]);
        // 1 unit vector from the top of the viewport to the bottom
        let PLAYER_VIEWPORT_VERTICAL_UNIT_VECTOR;
        if (Game.instance.player.pitch >= 0) {
            PLAYER_VIEWPORT_VERTICAL_UNIT_VECTOR =
                VectorMath.convertYawAndPitchToUnitVector([Game.instance.player.yaw, Game.instance.player.pitch - Math.PI / 2]);
        }
        else {
            PLAYER_VIEWPORT_VERTICAL_UNIT_VECTOR =
                VectorMath.convertYawAndPitchToUnitVector([Math.PI + Game.instance.player.yaw, -(Math.PI / 2 + Game.instance.player.pitch)]);
        }
        // bruh opposite direction != -1 * yaw, was stuck for 2 hours
        let playerToViewportTopLeftVector = VectorMath.addVectors(PLAYER_TO_VIEWPORT_CENTER_VECTOR, VectorMath.convertUnitVectorToVector(PLAYER_VIEWPORT_HORIZONTAL_UNIT_VECTOR, -Canvas.WIDTH / 2));
        playerToViewportTopLeftVector = VectorMath.addVectors(playerToViewportTopLeftVector, VectorMath.convertUnitVectorToVector(PLAYER_VIEWPORT_VERTICAL_UNIT_VECTOR, -Canvas.HEIGHT / 2));
        for (let x = 0; x < Canvas.WIDTH; x += Game.instance.resolution) {
            for (let y = 0; y < Canvas.HEIGHT; y += Game.instance.resolution) {
                let viewportTopLeftToPointVector = VectorMath.addVectors(VectorMath.convertUnitVectorToVector(PLAYER_VIEWPORT_HORIZONTAL_UNIT_VECTOR, x), VectorMath.convertUnitVectorToVector(PLAYER_VIEWPORT_VERTICAL_UNIT_VECTOR, y));
                let vectorFromPlayerToPoint = VectorMath.addVectors(playerToViewportTopLeftVector, viewportTopLeftToPointVector);
                let rayAngles = VectorMath.convertVectorToYawAndPitch(vectorFromPlayerToPoint);
                const RAW_RAY_DISTANCE = Game.instance.player.castBlockVisionRayVersion3(rayAngles[0], rayAngles[1]);
                // custom shading
                // render the pixel
                const COLOR = PIXEL_COLORS[RAW_RAY_DISTANCE[1]];
                const brightness = Math.min((GameMap.tileSize / RAW_RAY_DISTANCE[0]), 1) * Game.instance.brightnessMultiplier;
                Utilities.drawPixel(x, y, `rgb(
          ${Math.floor(COLOR[0] * brightness)},
          ${Math.floor(COLOR[1] * brightness)},
          ${Math.floor(COLOR[2] * brightness)}
          )`);
            }
        }
    }
}
class DisplayMenuAndSetMouseControllerCommand {
    menu;
    constructor(menu) {
        this.menu = menu;
    }
    execute() {
        this.menu.drawMenuAndMenuButtons();
        Game.instance.controller.assignMouseClickCommand(new MenuMouseClickedEventHandlerCommand(this.menu));
        Game.instance.controller.assignMouseMoveCommand(undefined);
    }
}
class MainGameEscapeKeyPressedCommand {
    execute() {
        new LockPointerCommand().execute();
    }
}
class TogglePauseCommand {
    execute() {
        const IS_PAUSED = Game.instance.isPaused;
        if (IS_PAUSED) { // if paused, unpause the game
            new SetMainGameControlsCommand().execute();
            Game.instance.brightnessMultiplier = Game.instance.defaultBrightnessMultiplier;
            Game.instance.isPaused = false;
        }
        else { // otherwise, pause the game
            // undo the last mouse movement to prevent sudden view changes (unpreventable bug)
            // Since first esc press is not registered by event listener, the only way to toggle
            // pause menu based on a singular click is to detect changes in the state of mouse lock
            // however, the mouse is sometimes unlocked and its movement registered before the change can be detected, 
            // resulting in a sudden shift in mouse movement
            new UndoLastMouseMoveCommand(Game.instance.controller.mouseMoveCommand).execute();
            new UnsetMainGameControlsCommand().execute();
            Game.instance.brightnessMultiplier = Game.instance.pauseMenuBrightnessMultiplier;
            Game.instance.controller.clearInput();
            Game.instance.isPaused = true;
        }
    }
}
class HandleMouseMoveCommand {
    dx = 0;
    dy = 0;
    _previousDX;
    _previousDY;
    get previousDX() {
        return this._previousDX;
    }
    get previousDY() {
        return this._previousDY;
    }
    assignMovement(dx, dy) {
        this.dx = dx;
        this.dy = dy;
        this._previousDX = this.dx;
        this._previousDY = this.dy;
        return this;
    }
}
class UndoLastMouseMoveCommand {
    c;
    constructor(c) {
        this.c = c;
    }
    execute() {
        Game.instance.player.rotatePitch(this.c.previousDY * Game.instance.player.rotationSpeed * Game.instance.controller.sensitivity);
        Game.instance.player.rotateYaw(-this.c.previousDX * Game.instance.player.rotationSpeed * Game.instance.controller.sensitivity);
    }
}
class MainGameHandleMouseMoveCommand extends HandleMouseMoveCommand {
    execute() {
        Game.instance.player.rotatePitch(-this.dy * Game.instance.player.rotationSpeed * Game.instance.controller.sensitivity);
        Game.instance.player.rotateYaw(this.dx * Game.instance.player.rotationSpeed * Game.instance.controller.sensitivity);
    }
}
class UpdatePlayerPositionToFirebaseCommand {
    player;
    constructor(player) {
        this.player = player;
    }
    execute() {
        update(ref(FirebaseClient.instance.db, `/players/${this.player.id}`), {
            x: this.player.x,
            y: this.player.y,
            z: this.player.z,
            color: this.player.colorCode
        });
    }
}
class UpdateBulletPositionToFirebaseCommand {
    bullet;
    constructor(bullet) {
        this.bullet = bullet;
    }
    execute() {
        update(ref(FirebaseClient.instance.db, `/bullets/${this.bullet.id}`), {
            x: this.bullet.x,
            y: this.bullet.y,
            z: this.bullet.z,
            id: this.bullet.id,
            sourcePlayerID: this.bullet.sourcePlayerID
        });
    }
}
class UpdateLaserToFirebaseCommand {
    laser;
    constructor(laser) {
        this.laser = laser;
    }
    execute() {
        update(ref(FirebaseClient.instance.db, `/lasers/${this.laser.id}`), {
            position: this.laser.position,
            direction: this.laser.directionVector,
            isOn: this.laser.isOn,
            id: this.laser.id,
            sourcePlayerID: this.laser.sourcePlayerID
        });
    }
}
class RemoveOwnLaserFromFirebaseCommand {
    execute() {
        set(ref(FirebaseClient.instance.db, `/lasers`), Game.instance.otherLasers);
    }
}
class RemoveBulletFromFirebaseByIDCommand {
    bulletid;
    constructor(bulletid) {
        this.bulletid = bulletid;
    }
    execute() {
        const BULLETS = Object.values(Game.instance.allBullets);
        for (let i = 0; i < BULLETS.length; i++) {
            if (BULLETS[i].id === this.bulletid) {
                delete Game.instance.allBullets[this.bulletid];
                set(ref(FirebaseClient.instance.db, `/bullets`), Game.instance.allBullets);
                return;
            }
        }
    }
}
class UploadBulletToFirebaseCommand {
    bullet;
    constructor(bullet) {
        this.bullet = bullet;
    }
    execute() {
        update(ref(FirebaseClient.instance.db, `/bullets/${this.bullet.id}`), {
            x: this.bullet.x,
            y: this.bullet.y,
            z: this.bullet.z,
            id: this.bullet.id,
            sourcePlayerID: this.bullet.sourcePlayerID
        });
    }
}
class RemoveClientPlayerFromDatabaseCommand {
    execute() {
        set(ref(FirebaseClient.instance.db, `/players`), Game.instance.otherPlayers);
    }
}
class RemoveAllBulletsBySelfFromDatabaseCommand {
    execute() {
        const BULLETS = Object.values(Game.instance.allBullets);
        for (let i = 0; i < BULLETS.length; i++) {
            if (BULLETS[i].sourcePlayerID === Game.instance.player.id) {
                delete Game.instance.allBullets[BULLETS[i].id];
            }
        }
        set(ref(FirebaseClient.instance.db, `/bullets`), Game.instance.allBullets);
    }
}
class LockPointerCommand {
    execute() {
        const havePointerLock = 'pointerLockElement' in document ||
            'mozPointerLockElement' in document ||
            'webkitPointerLockElement' in document;
        if (havePointerLock) {
            Canvas.instance.screen.requestPointerLock = Canvas.instance.screen.requestPointerLock ||
                //@ts-ignorets-ignore
                Canvas.instance.screen.mozRequestPointerLock ||
                //@ts-ignorets-ignore
                Canvas.instance.screen.webkitRequestPointerLock;
            Canvas.instance.screen.requestPointerLock();
        }
    }
}
class UnlockPointerCommand {
    execute() {
        document.exitPointerLock = document.exitPointerLock ||
            //@ts-ignorets-ignore
            document.mozExitPointerLock ||
            //@ts-ignorets-ignore
            document.webkitExitPointerLock;
        document.exitPointerLock();
    }
}
class ToggleLaserCommand {
    execute() {
        if (Game.instance.player.laser.isOn) {
            Game.instance.player.laser.isOn = false;
        }
        else {
            if (Game.instance.player.ammoGauge.canUse) {
                Game.instance.player.laser.isOn = true;
            }
        }
    }
}
class SetMainGameControlsCommand {
    execute() {
        Game.instance.controller.assignMouseMoveCommand(new MainGameHandleMouseMoveCommand());
        Game.instance.controller.assignMouseClickCommand(new MainGameMouseClickedEventHandlerCommand());
    }
}
class UnsetMainGameControlsCommand {
    execute() {
        Game.instance.controller.assignMouseMoveCommand(undefined);
        Game.instance.controller.assignMouseClickCommand(undefined);
    }
}
export { HandleMouseClickCommand, HandleMouseMoveCommand, MainGameHandleMouseMoveCommand, DisplayMenuAndSetMouseControllerCommand, StartGameCommand, MenuMouseClickedEventHandlerCommand, MainGameMouseClickedEventHandlerCommand, UpdatePlayerPositionToFirebaseCommand, RemoveClientPlayerFromDatabaseCommand, TogglePauseCommand, LockPointerCommand, ExitGameCommand, RenderViewForPlayerCommand, RemoveBulletFromFirebaseByIDCommand, UpdateBulletPositionToFirebaseCommand, ExitGameThenDisplayMenuCommand, UnlockPointerCommand, RemoveAllBulletsBySelfFromDatabaseCommand, UpdateLaserToFirebaseCommand, RemoveOwnLaserFromFirebaseCommand, DisplayTextCommand };
//# sourceMappingURL=Command.js.map