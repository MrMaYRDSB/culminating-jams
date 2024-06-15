import { Game } from "./Game.js";
import { update, ref, set
//@ts-ignore Import module
 } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { FirebaseClient } from "./FirebaseClient.js";
import { Canvas } from "./Canvas.js";
class HandleMouseClickCommand {
    mousePositionX = 0;
    mousePositionY = 0;
    // either do this or get the coordinates directly from controller in the execute
    // (if having an extra method in commands are not allowed)
    assignCoordinates(x, y) {
        this.mousePositionX = x;
        this.mousePositionY = y;
        return this;
    }
}
class MainGameMouseClickedEventHandlerCommand extends HandleMouseClickCommand {
    execute() { }
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
class StartGameCommand {
    execute() {
        Canvas.instance.screen.requestPointerLock();
        Game.instance.startGame();
        new SetMainGameControlsCommand().execute();
        Game.instance.controller.assignEscKeyPressedCommand(new MainGameEscapeKeyPressedCommand());
        Game.instance.controller.assignPointerLockChangeCommand(new TogglePauseCommand());
    }
}
class ExitGameCommand {
    execute() {
        new ExitGameCommand().execute();
        Game.instance.isPaused = true;
        new UnsetMainGameControlsCommand().execute();
        Game.instance.controller.assignEscKeyPressedCommand(undefined);
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
class MainGameMouseClickCommand extends HandleMouseClickCommand {
    execute() {
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
class SetMainGameControlsCommand {
    execute() {
        Game.instance.controller.assignMouseMoveCommand(new MainGameHandleMouseMoveCommand());
        Game.instance.controller.assignMouseClickCommand(new MainGameMouseClickCommand());
    }
}
class UnsetMainGameControlsCommand {
    execute() {
        Game.instance.controller.assignMouseMoveCommand(undefined);
        Game.instance.controller.assignMouseClickCommand(undefined);
    }
}
class ClearAllPlayersFromDatabaseCommand {
    execute() {
        set(ref(FirebaseClient.instance.db, `/players`), {});
    }
}
class RemoveClientPlayerFromDatabaseCommand {
    execute() {
        set(ref(FirebaseClient.instance.db, `/players`), Game.instance.otherPlayers);
    }
}
export { HandleMouseClickCommand, HandleMouseMoveCommand, MainGameHandleMouseMoveCommand, DisplayMenuAndSetMouseControllerCommand, StartGameCommand, MenuMouseClickedEventHandlerCommand, MainGameMouseClickedEventHandlerCommand, UpdatePlayerPositionToFirebaseCommand, ClearAllPlayersFromDatabaseCommand, RemoveClientPlayerFromDatabaseCommand, TogglePauseCommand };
//# sourceMappingURL=Command.js.map