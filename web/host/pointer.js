export default class Pointer {
    constructor(slot) {
        this.slot = slot;
        this.states = {};
        this.pos = { x: 0, y: 0 };
        this.hoveredElements = [];
        this.DIV = document.createElement('div');
        this.DIV.setAttribute('class', `P${slot+1} pointer`);
        this.DIV.appendChild(document.createElement('div'));
        document.body.appendChild(this.DIV);
        this.center();
    }
    clickAtPointer() {
        console.log(`click! (${this.slot})`);
        
        this.hoveredElements[0]?.click();
    }
    newPacket(data) {
        console.log(data.Gyroscope_Yaw, data.Gyroscope_Pitch);
        this.move(
            -data.Gyroscope_Yaw,
            -data.Gyroscope_Pitch
        );
        if (data.raw)
            this.rotateTo(data.raw.Gyroscope_Roll);

        // send button events
        if (data.A===1 && this.states.A===0)
            this.clickAtPointer();

        this.states = data;
    }
    center() {
        this.moveTo(document.documentElement.clientWidth/2, document.documentElement.clientHeight/2);
    }
    moveTo(x, y) {
        this.pos = { x: x, y: y };
        this.DIV.style.left = `${x}px`;
        this.DIV.style.top = `${y}px`;
        this.handleMoveEvents();
    }
    rotateTo(angle) {
        this.DIV.style.transform = `rotate(${angle}deg)`;
    }
    move(x, y) {
        const speedFactor = 0.00025;
        const xSpeed = document.documentElement.clientWidth * speedFactor;
        const ySpeed = document.documentElement.clientHeight * speedFactor;

        this.pos = { x: this.pos.x + x * xSpeed, y: this.pos.y + y * ySpeed };
        this.pos = {
            x: Math.min(Math.max(this.pos.x, 0), document.documentElement.clientWidth),
            y: Math.min(Math.max(this.pos.y, 0), document.documentElement.clientHeight)
        };
        this.DIV.style.left = `${this.pos.x}px`;
        this.DIV.style.top = `${this.pos.y}px`;
        this.handleMoveEvents();
    }
    handleMoveEvents() {
        let oldEls = [...this.hoveredElements];
        this.hoveredElements = [];
        document.elementsFromPoint(this.pos.x, this.pos.y).forEach(el => {
            if (el.tagName != 'BUTTON') return;
            if (el.classList.contains('pointer')) return;
            if (oldEls.includes(el)) {
                oldEls.splice(oldEls.indexOf(el), 1);
            }
            this.hoveredElements.push(el);
            el.classList.add('hover');
        });
        oldEls.forEach(e =>  e.classList.remove('hover') );
    }
    remove() {
        this.DIV.remove();
    }
}