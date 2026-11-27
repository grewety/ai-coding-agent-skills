using System;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;

internal static class ReviewFixture
{
    [StructLayout(LayoutKind.Sequential)]
    private struct StartupInfo
    {
        public int Size;
        public IntPtr Reserved, Desktop, Title;
        public int X, Y, XSize, YSize, XCount, YCount, Fill, Flags;
        public short ShowWindow, ReservedSize;
        public IntPtr ReservedBytes, StdIn, StdOut, StdErr;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct ProcessInfo
    {
        public IntPtr Process, Thread;
        public int ProcessId, ThreadId;
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr GetStdHandle(int id);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetHandleInformation(IntPtr handle, uint mask, uint flags);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CreateProcess(string application, StringBuilder command, IntPtr processAttributes,
        IntPtr threadAttributes, bool inheritHandles, uint flags, IntPtr environment, string workingDirectory,
        ref StartupInfo startup, out ProcessInfo process);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetExitCodeProcess(IntPtr handle, out int code);

    [DllImport("kernel32.dll")]
    private static extern bool CloseHandle(IntPtr handle);

    // CreateProcess accepts one Windows command-line string.
    private static string Quote(string value)
    {
        var quoted = new StringBuilder("\"");
        int backslashes = 0;
        foreach (char character in value)
        {
            if (character == '\\')
            {
                backslashes++;
                continue;
            }
            quoted.Append('\\', character == '"' ? 2 * backslashes + 1 : backslashes);
            quoted.Append(character);
            backslashes = 0;
        }
        return quoted.Append('\\', 2 * backslashes).Append('"').ToString();
    }

    private static int Main(string[] args)
    {
        string launcher = Assembly.GetExecutingAssembly().Location;
        if (args.Length == 1 && args[0] == "--version")
        {
            string client = Path.GetFileNameWithoutExtension(launcher);
            if (client == "kilo")
                Console.WriteLine("kilo 2.1.0");
            else
                Console.WriteLine(client == "agy" ? "agy 1.6.0" : "2.1.330 (Claude Code)");
            return 0;
        }

        string bin = Path.GetDirectoryName(launcher);
        string pythonPath = Path.Combine(bin, "python-path.txt");
        bool descendant = File.Exists(pythonPath) && !(args.Length == 1 && args[0] == "--help");
        string executable = File.ReadAllText(descendant ? pythonPath : Path.Combine(bin, "node-path.txt"));
        string script = Path.GetFullPath(Path.Combine(bin, "..", descendant ? "descendant.py" : "fixture.cjs"));
        string arguments = descendant ? "-I -B " + Quote(script) : Quote(script) + " " + String.Join(" ", Array.ConvertAll(args, Quote));
        // Explicitly propagate the supervisor's pipe handles and inherit its Job.
        var startup = new StartupInfo { Size = Marshal.SizeOf(typeof(StartupInfo)), Flags = 0x100,
            StdIn = GetStdHandle(-10), StdOut = GetStdHandle(-11), StdErr = GetStdHandle(-12) };
        foreach (IntPtr handle in new[] { startup.StdIn, startup.StdOut, startup.StdErr })
            if (!SetHandleInformation(handle, 1, 1)) return 91;
        var command = new StringBuilder(Quote(executable) + " " + arguments);
        ProcessInfo child;
        if (!CreateProcess(executable, command, IntPtr.Zero, IntPtr.Zero, true, 0x08000000, IntPtr.Zero,
            Environment.CurrentDirectory, ref startup, out child)) return 92;
        try
        {
            int code;
            return WaitForSingleObject(child.Process, UInt32.MaxValue) == 0 && GetExitCodeProcess(child.Process, out code) ? code : 93;
        }
        finally { CloseHandle(child.Thread); CloseHandle(child.Process); }
    }
}
