export function enterAction(shift:boolean, nativeComposing:boolean, composing:boolean, keyCode:number, repeat:boolean) {
    if(shift || nativeComposing || composing || keyCode===229)return 'edit';
    return repeat?'ignore':'submit';
}
