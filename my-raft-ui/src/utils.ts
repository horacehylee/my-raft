export const once = <T>(func: (param: T) => void) => {
  let triggered = false;
  return (param: T) => {
    if (!triggered) {
      func(param);
      triggered = true;
    }
  };
};
