export declare class TinyWASI {
    instance?: WebAssembly.Instance;
    private WASI_ERRNO_SUCCESS;
    private WASI_ERRNO_BADF;
    private WASI_ERRNO_NOSYS;
    private WASI_ERRNO_INVAL;
    private WASI_FILETYPE_CHARACTER_DEVICE;
    private WASI_RIGHTS_FD_SYNC;
    private WASI_RIGHTS_FD_WRITE;
    private WASI_RIGHTS_FD_FILESTAT_GET;
    private WASI_FDFLAGS_APPEND;
    private nameSpaces;
    constructor(trace?: boolean);
    initialize(instance: WebAssembly.Instance): void;
    get imports(): WebAssembly.Imports;
    getMemory(): WebAssembly.Memory;
    getDataView(): DataView;
    private trace;
    private nosys;
    private clock_res_get;
    private clock_time_get;
    private fd_fdstat_get;
    private fd_write;
    private random_get;
    private environ_sizes_get;
}
