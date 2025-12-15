export function makeDraggable(elmnt, handleId) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    const header = document.getElementById(handleId);
    const dragTarget = header || elmnt;

    // If element/header doesn't exist, safety check
    if (!dragTarget) return;

    dragTarget.onmousedown = dragMouseDown;
    dragTarget.ontouchstart = dragTouchStart;

    function dragMouseDown(e) {
        e = e || window.event;
        // Allow input interactions without dragging
        // Check if target or any parent up to dragTarget is a button/input
        let target = e.target;
        while (target && target !== dragTarget) {
            if (['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'LABEL'].includes(target.tagName)) return;
            target = target.parentNode;
        }

        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function dragTouchStart(e) {
        let target = e.target;
        while (target && target !== dragTarget) {
            if (['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'LABEL'].includes(target.tagName)) return;
            target = target.parentNode;
        }

        if (e.cancelable) e.preventDefault();
        const touch = e.touches[0];
        pos3 = touch.clientX;
        pos4 = touch.clientY;
        document.ontouchend = closeDragElement;
        document.ontouchmove = elementTouchDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
        elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
        elmnt.style.right = 'auto'; // Prevent conflicts
        elmnt.style.bottom = 'auto';
    }

    function elementTouchDrag(e) {
        if (e.cancelable) e.preventDefault();
        const touch = e.touches[0];
        pos1 = pos3 - touch.clientX;
        pos2 = pos4 - touch.clientY;
        pos3 = touch.clientX;
        pos4 = touch.clientY;
        elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
        elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
        elmnt.style.right = 'auto';
        elmnt.style.bottom = 'auto';
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
        document.ontouchend = null;
        document.ontouchmove = null;
    }
}
