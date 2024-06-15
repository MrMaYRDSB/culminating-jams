import { CompositeMenu } from "./Menu.js";
import { Game } from "./Game.js";
import { Player } from "./Player.js";
import {
  update,
  ref,
  set
  //@ts-ignore Import module
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { FirebaseClient } from "./FirebaseClient.js";
import { Canvas } from "./Canvas.js";

interface Command {
  execute(): void;
}

abstract class HandleMouseClickCommand implements Command {
  
  protected mousePositionX: number = 0
  protected mousePositionY: number = 0

  // either do this or get the coordinates directly from controller in the execute
  // (if having an extra method in commands are not allowed)
  public assignCoordinates(x: number, y: number): Command {
    this.mousePositionX = x;
    this.mousePositionY = y;
    return this
  }

  abstract execute(): void;
}


class MainGameMouseClickedEventHandlerCommand extends HandleMouseClickCommand{
  public execute(): void { }

}


class MenuMouseClickedEventHandlerCommand extends HandleMouseClickCommand {
  constructor(private menu: CompositeMenu) {
    super();
  }

  public execute(): void {
    for (let button of this.menu.buttons) {
      if (button.checkCoordinatesOnButton(this.mousePositionX, this.mousePositionY)) {
        button.executeCommand();
        break;
      }
    }
  }
}


class StartGameCommand implements Command {
  public execute(): void {
    Canvas.instance.screen.requestPointerLock();
    Game.instance.startGame()
    new SetMainGameControlsCommand().execute()
    Game.instance.controller.assignEscKeyPressedCommand(new MainGameEscapeKeyPressedCommand())
    Game.instance.controller.assignPointerLockChangeCommand(new TogglePauseCommand())
  }
}


class ExitGameCommand implements Command {
  public execute(): void {
    new ExitGameCommand().execute();
    Game.instance.isPaused = true;
    new UnsetMainGameControlsCommand().execute();
    Game.instance.controller.assignEscKeyPressedCommand(undefined)
  }
}


class DisplayMenuAndSetMouseControllerCommand implements Command {
  constructor(private menu: CompositeMenu) { }

  public execute(): void {
    this.menu.drawMenuAndMenuButtons();
    Game.instance.controller.assignMouseClickCommand(new MenuMouseClickedEventHandlerCommand(this.menu));
    Game.instance.controller.assignMouseMoveCommand(undefined)
  }
}


class MainGameEscapeKeyPressedCommand implements Command {
  public execute(): void {
    new LockPointerCommand().execute()
  }
}


class TogglePauseCommand implements Command {

  public execute(): void {
    const IS_PAUSED: boolean = Game.instance.isPaused;
    if (IS_PAUSED) { // if paused, unpause the game
      new SetMainGameControlsCommand().execute()
      Game.instance.brightnessMultiplier = Game.instance.defaultBrightnessMultiplier
      Game.instance.isPaused = false
    } else { // otherwise, pause the game


      // undo the last mouse movement to prevent sudden view changes (unpreventable bug)
      // Since first esc press is not registered by event listener, the only way to toggle
      // pause menu based on a singular click is to detect changes in the state of mouse lock
      // however, the mouse is sometimes unlocked and its movement registered before the change can be detected, 
      // resulting in a sudden shift in mouse movement
      new UndoLastMouseMoveCommand(Game.instance.controller.mouseMoveCommand).execute()
      
      new UnsetMainGameControlsCommand().execute()
      Game.instance.brightnessMultiplier = Game.instance.pauseMenuBrightnessMultiplier
      Game.instance.controller.clearInput();
      Game.instance.isPaused = true
    }
  }
}


abstract class HandleMouseMoveCommand implements Command {
  protected dx: number = 0;
  protected dy: number = 0

  private _previousDX: number | undefined;
  private _previousDY: number | undefined;

  public get previousDX(): number {
    return this._previousDX;
  }

  public get previousDY(): number {
    return this._previousDY
  }

  public assignMovement(dx: number, dy: number): HandleMouseMoveCommand {
    this.dx = dx
    this.dy = dy
    
    this._previousDX = this.dx;
    this._previousDY = this.dy
    return this
  }


  abstract execute(): void;
}


class UndoLastMouseMoveCommand implements Command {
  constructor(protected c: HandleMouseMoveCommand) { }
  
  public execute(): void {
    Game.instance.player.rotatePitch(this.c.previousDY * Game.instance.player.rotationSpeed * Game.instance.controller.sensitivity)
    Game.instance.player.rotateYaw(-this.c.previousDX * Game.instance.player.rotationSpeed * Game.instance.controller.sensitivity)
  }
}


class MainGameHandleMouseMoveCommand extends HandleMouseMoveCommand implements Command {
  public execute(): void {
    Game.instance.player.rotatePitch(-this.dy * Game.instance.player.rotationSpeed * Game.instance.controller.sensitivity)
    Game.instance.player.rotateYaw(this.dx * Game.instance.player.rotationSpeed * Game.instance.controller.sensitivity)
  }
}

class UpdatePlayerPositionToFirebaseCommand implements Command {
  constructor(protected player: Player) { }

  public execute(): void {
    update(
      ref(FirebaseClient.instance.db, `/players/${this.player.id}`),
      {
        x: this.player.x, 
        y: this.player.y,
        z: this.player.z,
        color: this.player.colorCode
      }
    )
  }
}


class MainGameMouseClickCommand extends HandleMouseClickCommand implements Command {
  public execute(): void {

  }
}


class LockPointerCommand implements Command {
  public execute(): void {
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


class UnlockPointerCommand implements Command {
  public execute(): void {
    document.exitPointerLock = document.exitPointerLock ||
    //@ts-ignorets-ignore
    document.mozExitPointerLock! ||
    //@ts-ignorets-ignore
    document.webkitExitPointerLock!;
  
    document.exitPointerLock();
  }
}


class SetMainGameControlsCommand implements Command {
  public execute(): void {
    Game.instance.controller.assignMouseMoveCommand(new MainGameHandleMouseMoveCommand())
    Game.instance.controller.assignMouseClickCommand(new MainGameMouseClickCommand())
  }
}


class UnsetMainGameControlsCommand implements Command {
  public execute(): void {
    Game.instance.controller.assignMouseMoveCommand(undefined)
    Game.instance.controller.assignMouseClickCommand(undefined)
  }
}


class ClearAllPlayersFromDatabaseCommand implements Command {
  public execute(): void {
    set(ref(FirebaseClient.instance.db, `/players`), {})
  }
}


class RemoveClientPlayerFromDatabaseCommand implements Command {
  public execute(): void {
    set(ref(FirebaseClient.instance.db, `/players`), Game.instance.otherPlayers)
  }
}


export {
  Command,
  HandleMouseClickCommand,
  HandleMouseMoveCommand,
  MainGameHandleMouseMoveCommand, 
  DisplayMenuAndSetMouseControllerCommand,
  StartGameCommand,
  MenuMouseClickedEventHandlerCommand,
  MainGameMouseClickedEventHandlerCommand,
  UpdatePlayerPositionToFirebaseCommand,
  ClearAllPlayersFromDatabaseCommand, 
  RemoveClientPlayerFromDatabaseCommand, 
  TogglePauseCommand
}