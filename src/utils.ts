
export class Utils {
   public static getPrototype(obj: any) {
      if (typeof obj === 'function') {
         return obj.prototype;
      }
      
      if (Object.getPrototypeOf) {
         return Object.getPrototypeOf(obj);
      }
      else if (obj) {
         return obj.__proto__;
      }
      return undefined;
   }
}