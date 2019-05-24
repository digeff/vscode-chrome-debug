interface ObjectConstructor {
    keys<T>(o: T): RemoveSymbols<(keyof T)>[];
}
declare var Object: ObjectConstructor;

type RemoveSymbols<S> = S extends string ? S : string;