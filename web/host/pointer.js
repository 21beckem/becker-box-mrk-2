export default class Pointer {
    constructor(slot, playerId) {
        this.id = playerId;
        this.states = {};
        this.btnEvents = {
            'u_click': function(){},
            'u_down': function(){},
            'u_up': function(){},
            'l_click': function(){},
            'l_down': function(){},
            'l_up': function(){},
            'r_click': function(){},
            'r_down': function(){},
            'r_up': function(){},
            'd_click': function(){},
            'd_down': function(){},
            'd_up': function(){},
            'a_click': this.clickAtPointer.bind(this),
            'a_down': function(){},
            'a_up': function(){},
            'b_click': function(){},
            'b_down': function(){},
            'b_up': function(){},
            '-_click': function(){},
            '-_down': function(){},
            '-_up': function(){},
            'H_click': function(){},
            'H_down': function(){},
            'H_up': function(){},
            '+_click': function(){},
            '+_down': function(){},
            '+_up': function(){},
            '1_click': function(){},
            '1_down': function(){},
            '1_up': function(){},
            '2_click': function(){},
            '2_down': function(){},
            '2_up': function(){}
        }
        this.pos = { x: 0, y: 0 };
        this.hoveredElements = [];
        this.DIV = document.createElement('div');
        this.DIV.setAttribute('class', `P${slot+1} pointer`);
        this.DIV.appendChild(document.createElement('div'));
        document.body.appendChild(this.DIV);
        this.center();
    }
    addEventListener(btn, event, callback) {
        this.btnEvents[btn+'_'+event] = callback;
    }
    removeEventListener(btn, event) {
        this.btnEvents[btn+'_'+event] = function(){};
    }
    clearEventListeners() {
        for (const [key, value] of Object.entries(this.btnEvents)) {
            this.btnEvents[key] = function(){};
        }
        this.btnEvents['a_click'] = this.clickAtPointer.bind(this);
    }
    clickAtPointer() {
        try {
            this.hoveredElements[0].click();
        } catch (e) {}
    }
    newPacket(data) {
        this.move(
            -data['gyro']['z'],
            -data['gyro']['x']
        );
        // send button events
        for (const [key, value] of Object.entries(data.buttons)) {
            if (value != this.states[key]) {
                if (value) {
                    this.btnEvents[key + '_down']();
                } else {
                    this.btnEvents[key + '_up']();
                    this.btnEvents[key + '_click']();
                }
            }
        }
        this.states = data.buttons;
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
    move(x, y) {
        const speedFactor = 0.03;
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
    destroy() {
        this.DIV.remove();
    }
}