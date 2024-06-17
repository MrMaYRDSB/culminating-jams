import { PlayerController } from "./PlayerController.js";
import { Canvas } from "./Canvas.js";
import { DisplayMenuAndSetMouseControllerCommand, ExitGameCommand, ExitGameThenDisplayMenuCommand, LockPointerCommand, RemoveBulletFromFirebaseByIDCommand, RemoveClientPlayerFromDatabaseCommand, RenderViewForPlayerCommand, StartGameCommand, TogglePauseCommand, UnlockPointerCommand, UpdateBulletPositionToFirebaseCommand } from "./Command.js";
import { Utilities } from "./Utilities.js";
import { Player } from "./Player.js";
import { GameMap } from "./Map.js";
import { CompositeMenu, MenuButton } from "./Menu.js";
import { PIXEL_COLORS } from "./Map.js";
import {
  ref,
  onValue,
  //@ts-ignore Import module
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { FirebaseClient } from "./FirebaseClient.js";
import { Vector, VectorMath, Direction, Position } from "./Vector.js";
import { Bullet } from "./Bullet.js";
import { Rectangle } from "./Shapes.js";

class Game {
  private static _instance: Game | undefined;
  readonly player: Player = new Player()
  readonly gameMap: GameMap = new GameMap()
  readonly controller: PlayerController = new PlayerController(this.player)
  private context = Canvas.instance.context;
  private gameLoop: any = undefined;
  readonly FPS: number = 30;
  private timeInterval: number = 1000/this.FPS
  readonly resolution: number = 10;
  readonly gravitationalAccelerationConstant: number = 1
  readonly terminalVelocity: number = 12
  readonly maxRenderDistance: number = 8 * GameMap.tileSize;
  readonly pauseMenuBrightnessMultiplier: number = 0.1
  readonly defaultBrightnessMultiplier: number = 0.9;
  public brightnessMultiplier: number = this.defaultBrightnessMultiplier;

  public spawnLocation: Position = [GameMap.tileSize * 1.5, GameMap.tileSize * 1.5, GameMap.tileSize * 1.9]
  public spawnDirection: Direction = [0, 0]

  public isPaused: boolean = true;
  
  private _mainMenu: CompositeMenu = new CompositeMenu("JamesCraft But With Guns")
  private pauseMenu: CompositeMenu = new CompositeMenu("Game Paused")
  private _gameOverMenu: CompositeMenu = new CompositeMenu("Game Over")

  public bulletsBySelf: Bullet[] = [];
  public bulletsToRemove: Bullet[] = [];

  public otherPlayers = {}
  public allBullets = {}


  public healthBar: Rectangle = new Rectangle(Canvas.WIDTH/2 - 300, Canvas.HEIGHT-80, "Black", 600, 60)


  public get mainMenu(): CompositeMenu {
    return this._mainMenu
  }

  public get gameOverMenu(): CompositeMenu {
    return this._gameOverMenu;
  }


  private constructor() {
    this.composeMainMenu()
    this.composePauseMenu()
    this.composeGameOverMenu()

    window.addEventListener("beforeunload", function (e) {
      Game.instance.endGame()
      new RemoveClientPlayerFromDatabaseCommand().execute()
    });
  }

  public start() {
    new DisplayMenuAndSetMouseControllerCommand(this.mainMenu).execute()
  }

  public updateFromDatabase(): void {
    onValue(
      ref(FirebaseClient.instance.db, "/players"),
      (snapshot) => {
        if (snapshot.val()) {
          this.otherPlayers = snapshot.val();

          //Remove the player, but keep all the other users
          delete this.otherPlayers[this.player.id];
        }
      },
      { onlyOnce: true }
    );

    onValue(
      ref(FirebaseClient.instance.db, "/bullets"), 
      (snapshot) => {
        if (snapshot.val()) {
          this.allBullets = snapshot.val()
        }
      },
      { onlyOnce: true }
    )
  }


  public updateOwnBulletsAndUpdateToFirebase(): void {
    for (let i = 0; i < this.bulletsBySelf.length; i++) {
      const bullet: Bullet = this.bulletsBySelf[i]
      bullet.updatePosition();
      new UpdateBulletPositionToFirebaseCommand(bullet).execute()

      if (bullet.collideWithWall()) {
        this.bulletsBySelf.splice(i, 1);
        this.bulletsToRemove.push(bullet)
      }

      for (let i = 0; i < this.bulletsToRemove.length; i++) {
        const B: Bullet = this.bulletsToRemove[i]
        if (this.allBullets[B.id]) {
          new RemoveBulletFromFirebaseByIDCommand(B.id).execute()
          this.bulletsToRemove.splice(i, 1)
        }
      }
    }
  }


  public startGame() {
    this.player.setLocation(this.spawnLocation)
    this.player.setDirection(this.spawnDirection)
    this.player.resetHealth()
    this.controller.assignPointerLockChangeCommand(new TogglePauseCommand())

    this.gameLoop = setInterval(() => {
      const TIME: number = performance.now()
      this.updateFromDatabase()
      this.player.update()
      this.updateOwnBulletsAndUpdateToFirebase()
      this.checkPlayerCollisionWithBullets()
      this.renderForPlayer()
      this.renderPlayerUI()

      if (this.player.health <= 0) {
        this.controller.assignPointerLockChangeCommand(undefined)
        new UnlockPointerCommand().execute()
        new ExitGameThenDisplayMenuCommand(this.gameOverMenu).execute()
        return
      }

      if (this.isPaused) {
        new DisplayMenuAndSetMouseControllerCommand(this.pauseMenu).execute()
      }




      // displays FPS
      this.context.font = "24px Arial"
      this.context.fillStyle = "white"
      this.context.fillText(`MAX FPS: ${Math.round(1000 / (performance.now()-TIME))}`, 50, 50)
    }, this.timeInterval);
  }

  public composeMainMenu(): void {
    const START_BUTTON: MenuButton = new MenuButton(
      Canvas.WIDTH / 2 - MenuButton.buttonWidth / 2,
      Canvas.HEIGHT / 2 - MenuButton.buttonHeight / 2,
      "start game"
    )
    START_BUTTON.addCommand(new StartGameCommand())
    this._mainMenu.addMenuButton(START_BUTTON)
  }


  public composePauseMenu(): void {
    
    const RESUME_BUTTON: MenuButton = new MenuButton(
      Canvas.WIDTH / 2 - MenuButton.buttonWidth / 2,
      Canvas.HEIGHT / 2 - MenuButton.buttonHeight * 2,
      "Resume Game"
    )
    RESUME_BUTTON.addCommand(new LockPointerCommand())

    const EXIT_BUTTON: MenuButton = new MenuButton(
      Canvas.WIDTH / 2 - MenuButton.buttonWidth / 2,
      Canvas.HEIGHT / 2 + MenuButton.buttonHeight,
      "Exit Game"
    )
    EXIT_BUTTON.addCommand(new ExitGameThenDisplayMenuCommand(this.mainMenu))
    this.pauseMenu.addMenuButton(RESUME_BUTTON);
    this.pauseMenu.addMenuButton(EXIT_BUTTON);
    this.pauseMenu.assignRenderBackgroundCommand(new RenderViewForPlayerCommand())
  }

  private composeGameOverMenu(): void {
    const MENU_BUTTON: MenuButton = new MenuButton(
      Canvas.WIDTH / 2 - MenuButton.buttonWidth / 2,
      Canvas.HEIGHT / 2 - MenuButton.buttonHeight / 2,
      "Return To Menu"
    )

    MENU_BUTTON.addCommand(new DisplayMenuAndSetMouseControllerCommand(this.mainMenu))
    this.gameOverMenu.addMenuButton(MENU_BUTTON)
    this.gameOverMenu.assignRenderBackgroundCommand(new RenderViewForPlayerCommand())
  }

  public endGame() {
    this.isPaused = true
    this.controller.assignEscKeyPressedCommand(undefined)
    this.brightnessMultiplier = Game.instance.pauseMenuBrightnessMultiplier
    this.controller.clearInput();
    clearInterval(this.gameLoop);
    new RemoveClientPlayerFromDatabaseCommand().execute()
    this.player.determineIntendedMovementDirectionVectorBasedOnAccelerationDirections()
  }


  private checkPlayerCollisionWithBullets(): void {
    const BULLET_POSITIONS: { x: number, y: number, z: number, id: string, sourcePlayerID: string }[] = Object.values(Game.instance.allBullets)
    for (let bullet of BULLET_POSITIONS) {
      const bmin: Position = [bullet.x - Bullet.size / 2, bullet.y - Bullet.size / 2, bullet.z - Bullet.size / 2];
      const bmax: Position = [bullet.x + Bullet.size / 2, bullet.y + Bullet.size / 2, bullet.z + Bullet.size / 2];

      if (
        VectorMath.rectanglesCollide(bmin, bmax, this.player.charMin, this.player.charMax) &&
        bullet.sourcePlayerID !== this.player.id
      ) {
        this.player.takeDamage(1)
      }
    }
  }

  private clearScreen(): void {
    this.context.clearRect(0, 0, Canvas.WIDTH, Canvas.HEIGHT);
  }

  private renderPlayerUI(): void {

    // Draw crosshair
    Utilities.drawLine(Canvas.WIDTH / 2 - 10, Canvas.HEIGHT / 2, Canvas.WIDTH / 2 + 10, Canvas.HEIGHT / 2, "white");
    Utilities.drawLine(Canvas.WIDTH / 2 - 10, Canvas.HEIGHT / 2 +1 , Canvas.WIDTH / 2 + 10, Canvas.HEIGHT / 2 +1, "white");
    Utilities.drawLine(Canvas.WIDTH / 2 - 10, Canvas.HEIGHT / 2 -1 , Canvas.WIDTH / 2 + 10, Canvas.HEIGHT / 2 -1, "white");

    Utilities.drawLine(Canvas.WIDTH / 2, Canvas.HEIGHT / 2 - 10, Canvas.WIDTH / 2, Canvas.HEIGHT / 2 + 10, "white");
    Utilities.drawLine(Canvas.WIDTH / 2 +1, Canvas.HEIGHT / 2-10, Canvas.WIDTH / 2 +1, Canvas.HEIGHT / 2+10, "white");
    Utilities.drawLine(Canvas.WIDTH / 2 - 1, Canvas.HEIGHT / 2 - 10, Canvas.WIDTH / 2 - 1, Canvas.HEIGHT / 2 + 10, "white");
    
    this.healthBar.draw()
    Canvas.instance.context.fillStyle = "red"
    Canvas.instance.context.fillRect(
      (Canvas.WIDTH/2) - 290, Canvas.HEIGHT - 70, (this.player.health / this.player.maxHealth) * 580, 40
    )
  }

  private renderForPlayer() {
    this.clearScreen()

    const ADJACENT_LENGTH_MAGNITUDE: number = (Canvas.WIDTH / 2) / Math.tan(this.player.fov / 2)
    const PLAYER_TO_VIEWPORT_CENTER_UNIT_VECTOR: Vector =
      VectorMath.convertYawAndPitchToUnitVector([this.player.yaw, this.player.pitch])
    const PLAYER_TO_VIEWPORT_CENTER_VECTOR: Vector =
      VectorMath.convertUnitVectorToVector(PLAYER_TO_VIEWPORT_CENTER_UNIT_VECTOR, ADJACENT_LENGTH_MAGNITUDE)
    
    // 1 unit vector from the left of the view port to the right
    const PLAYER_VIEWPORT_HORIZONTAL_UNIT_VECTOR: Vector = 
      VectorMath.convertYawAndPitchToUnitVector([this.player.yaw + Math.PI / 2, 0])
    
    // 1 unit vector from the top of the viewport to the bottom
    let PLAYER_VIEWPORT_VERTICAL_UNIT_VECTOR: Vector
    
    if (this.player.pitch >= 0) {
      PLAYER_VIEWPORT_VERTICAL_UNIT_VECTOR =
        VectorMath.convertYawAndPitchToUnitVector([this.player.yaw, this.player.pitch - Math.PI / 2]);
    } else {
      PLAYER_VIEWPORT_VERTICAL_UNIT_VECTOR =
        VectorMath.convertYawAndPitchToUnitVector([Math.PI + this.player.yaw, -(Math.PI / 2 + this.player.pitch)]);
    }
    // bruh opposite direction != -1 * yaw, was stuck for 2 hours

    let playerToViewportTopLeftVector: Vector = VectorMath.addVectors(
      PLAYER_TO_VIEWPORT_CENTER_VECTOR,
      VectorMath.convertUnitVectorToVector(PLAYER_VIEWPORT_HORIZONTAL_UNIT_VECTOR, -Canvas.WIDTH/2)
    )
    playerToViewportTopLeftVector = VectorMath.addVectors(
      playerToViewportTopLeftVector,
      VectorMath.convertUnitVectorToVector(PLAYER_VIEWPORT_VERTICAL_UNIT_VECTOR, -Canvas.HEIGHT/2)
    )

    
    for (let x: number = 0; x < Canvas.WIDTH; x += this.resolution) {
      // default ray cast
      // const CURRENT_RAY_YAW = (this.player.yaw - this.player.fov / 2) +
      //   (x / Canvas.WIDTH) * this.player.fov;

      // attempted fix to gradient
      // let rayAngleYaw: number = Utilities.calculateAngleFromLeftOfCone(
      //   this.player.fov, Canvas.WIDTH, x
      // )

      // problem lies in this line, should not add, but use a formula to combine the two
      // ie imagine the player is looking up, the player's viewport is a plane not paralle to any axial planes
      // therefore, when viewed from above, the player's viewport's vertices have different yaws
      // 

      // fix: since player's angle can be expressed as a vector, do that, then for every pixel, express it as a vector from the center of the viewport plane, then perform vector addition, and convert the resultant back to yaw and pitch
      
      // note that conversion must first be done to incoporate Canvas size as a part of the viewport plane.
      
      // with this fix, x and y would not be seperate, each pair of x and y will generate a unique resultant vector, and thereby a unique pitch and yaw
      // rayAngleYaw += (this.player.yaw - this.player.fov / 2)

      for (let y: number = 0; y < Canvas.HEIGHT; y += this.resolution) {
        // old ray pitch
        // const CURRENT_RAY_PITCH = (this.player.pitch + VERTICAL_FOV / 2) -
        //   (y / Canvas.HEIGHT) * VERTICAL_FOV

        // attempted fix to gradient
        // Note that this does nothing right now

        // let rayAnglePitch: number = Utilities.calculateAngleFromLeftOfCone(
        //   VERTICAL_FOV, Canvas.HEIGHT, y
        // )
        // rayAnglePitch = (this.player.pitch + VERTICAL_FOV / 2) - rayAnglePitch
        


        let viewportTopLeftToPointVector: Vector =
          VectorMath.addVectors(
            VectorMath.convertUnitVectorToVector(PLAYER_VIEWPORT_HORIZONTAL_UNIT_VECTOR, x),
            VectorMath.convertUnitVectorToVector(PLAYER_VIEWPORT_VERTICAL_UNIT_VECTOR, y)
          );
        let vectorFromPlayerToPoint: Vector = VectorMath.addVectors(playerToViewportTopLeftVector, viewportTopLeftToPointVector)
        let rayAngles: Direction = VectorMath.convertVectorToYawAndPitch(vectorFromPlayerToPoint)

        const RAW_RAY_DISTANCE: number[] = this.player.castBlockVisionRayVersion3(rayAngles[0], rayAngles[1]);
        
        // custom shading
        // render the pixel
        const COLOR: number[] = PIXEL_COLORS[RAW_RAY_DISTANCE[1]]
        const brightness: number = Math.min((GameMap.tileSize / RAW_RAY_DISTANCE[0]), 1) * this.brightnessMultiplier

        Utilities.drawPixel(x, y, `rgb(
          ${Math.floor(COLOR[0] * brightness)},
          ${Math.floor(COLOR[1] * brightness)},
          ${Math.floor(COLOR[2] * brightness)}
          )`)
      }
    }
  }

  
  public static get instance(): Game {
    if (Game._instance === undefined) {
      Game._instance = new Game()
    }
    return Game._instance;
  }
}


export {Game}