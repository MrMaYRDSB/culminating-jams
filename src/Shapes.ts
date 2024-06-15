import { Canvas } from "./Canvas.js";

class Rectangle {
  constructor(
    protected _x: number,
    protected _y: number,
    protected color: string,
    protected _width: number,
    protected _height: number
  ) { }

  public get width(): number {
    return this._width;
  }

  public get height(): number {
    return this._height;
  }

  public get x(): number {
    return this._x
  }

  public get y(): number {
    return this._y
  }
  
  public draw() {
    Canvas.instance.context.fillStyle = this.color;
    Canvas.instance.context.fillRect(this.x, this.y, this.width, this.height);
  }
}


class RectangularPrism {
  constructor(
    protected _x: number, protected _y: number, protected _z: number,
    protected _xLength: number, protected _yLength: number, protected _height: number
  ) { }

  public get x(): number {
    return this._x
  }

  public get y(): number {
    return this._y
  }

  public get z(): number {
    return this._z
  }

  public get xLength(): number {
    return this._xLength
  }

  public get yLength(): number {
    return this._yLength
  }

  public get height(): number {
    return this._height
  }


}


export {Rectangle, RectangularPrism}