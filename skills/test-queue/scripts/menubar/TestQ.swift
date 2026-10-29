// TestQ: menu bar widget for the shared test queue (scripts/testq). UI texts are Czech.
// Reads and writes the same files as testq in ~/.local/state/testq.
import AppKit
import Darwin
import SwiftUI

let stateDir = ProcessInfo.processInfo.environment["TESTQ_HOME"]
    ?? NSString(string: "~/.local/state/testq").expandingTildeInPath
let jobsDir = stateDir + "/jobs"
let configPath = stateDir + "/config.json"
let historyPath = stateDir + "/history.jsonl"
let mutexPath = stateDir + "/mutex.lock"
let vmStatePath = stateDir + "/vm.json"
let colimaConfigPath = (ProcessInfo.processInfo.environment["COLIMA_HOME"]
    ?? NSString(string: "~/.colima").expandingTildeInPath) + "/default/colima.yaml"
let testqPath = NSString(string: "~/.local/bin/testq").expandingTildeInPath
let vmBusyPhases: Set<String> = ["inventory", "stopping", "starting", "containers"]

// Fallback only: `testq init` writes the limits tuned for the machine into config.json.
let defaultConfig: [String: Any] = [
    "enabled": true, "paused": false, "budget": 8,
    "weights": ["light": 1, "medium": 3, "heavy": 5],
    "max": ["light": 4, "medium": 2, "heavy": 1],
    "mem_min_level": 20, "max_load": 0, "settle_seconds": 15, "workers": 2, "nice": 5,
]

struct Job: Identifiable, Decodable {
    let id: String
    let pid: Int32
    let childPid: Int32?
    let jobClass: String
    let state: String
    let project: String?
    let label: String?
    let queuedAt: Double
    let startedAt: Double?

    enum CodingKeys: String, CodingKey {
        case id, pid, state, project, label
        case childPid = "child_pid", jobClass = "class", queuedAt = "queued_at", startedAt = "started_at"
    }
}

struct HistoryEntry: Identifiable, Decodable {
    let id: String
    let jobClass: String
    let project: String?
    let label: String?
    let queuedAt: Double
    let startedAt: Double?
    let endedAt: Double
    let exit: Int

    enum CodingKeys: String, CodingKey {
        case id, project, label, exit
        case jobClass = "class", queuedAt = "queued_at", startedAt = "started_at", endedAt = "ended_at"
    }
}

struct Estimate: Decodable {
    let run: Double
    let basis: String
    let start: Double?
    let end: Double?
}

struct Forecast: Decodable {
    let estimates: [String: Estimate]
    let queueEnd: Double?

    enum CodingKeys: String, CodingKey {
        case estimates
        case queueEnd = "queue_end"
    }
}

let toolPath = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

// Estimates come from `testq status --json`, which replays the queue with run times from the history.
func readForecast() -> Forecast? {
    let process = Process()
    let pipe = Pipe()
    process.executableURL = URL(fileURLWithPath: testqPath)
    process.arguments = ["status", "--json"]
    var env = ProcessInfo.processInfo.environment
    env["PATH"] = toolPath
    process.environment = env
    process.standardOutput = pipe
    process.standardError = FileHandle.nullDevice
    guard (try? process.run()) != nil else { return nil }
    let data = pipe.fileHandleForReading.readDataToEndOfFile()
    process.waitUntilExit()
    return process.terminationStatus == 0 ? try? JSONDecoder().decode(Forecast.self, from: data) : nil
}

func pidAlive(_ pid: Int32?) -> Bool {
    guard let pid, pid > 0 else { return false }
    return kill(pid, 0) == 0 || errno == EPERM
}

func withMutex(_ body: () -> Void) {
    let fd = open(mutexPath, O_CREAT | O_RDWR, 0o644)
    guard fd >= 0 else { return body() }
    flock(fd, LOCK_EX)
    body()
    close(fd)
}

func fmtDuration(_ seconds: Double) -> String {
    let s = Int(max(seconds, 0))
    if s < 60 { return "\(s)s" }
    if s < 3600 { return String(format: "%dm%02ds", s / 60, s % 60) }
    return String(format: "%dh%02dm", s / 3600, s % 3600 / 60)
}

@MainActor
final class Model: ObservableObject {
    @Published var jobs: [Job] = []
    @Published var history: [HistoryEntry] = []
    @Published var config: [String: Any] = defaultConfig
    @Published var cpu = 0.0
    @Published var memUsed = 0.0
    @Published var swapUsed = 0.0
    @Published var swapTotal = 0.0
    @Published var load = 0.0
    @Published var now = Date().timeIntervalSince1970
    @Published var vmMemory: Int?
    @Published var vmTarget = 0
    @Published var vmState: [String: Any] = [:]
    @Published var forecast: Forecast?
    let ncpu = ProcessInfo.processInfo.activeProcessorCount
    let ramGB = Int(ProcessInfo.processInfo.physicalMemory / 1_073_741_824)
    private var vmTargetEdited = false
    private var forecastAt = 0.0
    private var forecastJobs: [String] = []
    private var forecasting = false
    private var prevTicks: (busy: UInt64, total: UInt64)?
    private var timer: Timer?

    init() {
        try? FileManager.default.createDirectory(atPath: jobsDir, withIntermediateDirectories: true)
        refresh()
        timer = Timer.scheduledTimer(withTimeInterval: 2, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.refresh() }
        }
    }

    var running: [Job] { jobs.filter { $0.state == "running" } }
    var waiting: [Job] { jobs.filter { $0.state == "waiting" } }
    var enabled: Bool { config["enabled"] as? Bool ?? true }
    var paused: Bool { config["paused"] as? Bool ?? false }
    var swapFraction: Double { swapTotal > 0 ? swapUsed / swapTotal : 0 }
    var stressed: Bool { memUsed > 0.85 || swapFraction > 0.85 }

    func intValue(_ path: String) -> Int {
        let parts = path.split(separator: ".").map(String.init)
        var node: Any? = config
        for part in parts { node = (node as? [String: Any])?[part] }
        return (node as? NSNumber)?.intValue ?? 0
    }

    func estimate(_ job: Job) -> Estimate? { forecast?.estimates[job.id] }

    func refresh() {
        now = Date().timeIntervalSince1970
        readStats()
        readConfig()
        readJobs()
        readHistory()
        readVM()
        refreshForecast()
    }

    private func refreshForecast() {
        let ids = jobs.map(\.id)
        guard !forecasting, !ids.isEmpty, ids != forecastJobs || now - forecastAt >= 10 else {
            if ids.isEmpty { forecast = nil }
            return
        }
        forecasting = true
        forecastAt = now
        forecastJobs = ids
        DispatchQueue.global(qos: .utility).async { [weak self] in
            let result = readForecast()
            Task { @MainActor in
                guard let self else { return }
                self.forecasting = false
                if let result { self.forecast = result }
            }
        }
    }

    var vmPhase: String { vmState["phase"] as? String ?? "" }
    var vmBusy: Bool {
        // a phase older than 20 minutes belongs to a resize that died without finishing
        vmBusyPhases.contains(vmPhase) && now - ((vmState["updated_at"] as? Double) ?? now) < 1200
    }

    func setVMTarget(_ value: Int) {
        vmTarget = value
        vmTargetEdited = true
    }

    private func readVM() {
        let text = (try? String(contentsOfFile: colimaConfigPath, encoding: .utf8)) ?? ""
        vmMemory = text.split(separator: "\n")
            .first { $0.hasPrefix("memory:") }
            .flatMap { Int($0.dropFirst("memory:".count).trimmingCharacters(in: .whitespaces)) }
        if let vmMemory, !vmTargetEdited || vmBusy { vmTarget = vmMemory }
        if let data = FileManager.default.contents(atPath: vmStatePath),
           let state = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            vmState = state
        }
    }

    func restartVM() {
        let busyJobs = running.count
        let alert = NSAlert()
        alert.messageText = vmTarget == vmMemory ? "Restartovat Colimu?" : "Restartovat Colimu s \(vmTarget) GB?"
        alert.informativeText = "Všechny Docker kontejnery se asi na minutu zastaví a pak se samy znovu spustí. "
            + "Fronta testů se mezitím pozastaví. Dev servery a připojení k databázím na tu dobu spadnou."
            + (busyJobs > 0 ? "\n\nPrávě běží \(busyJobs) test(ů) – přijdou o kontejnery a spadnou." : "")
        alert.addButton(withTitle: "Restartovat")
        alert.addButton(withTitle: "Zrušit")
        NSApp.activate(ignoringOtherApps: true)
        guard alert.runModal() == .alertFirstButtonReturn else { return }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: testqPath)
        process.arguments = ["vm", "restart", "--memory", String(vmTarget)] + (busyJobs > 0 ? ["--force"] : [])
        var env = ProcessInfo.processInfo.environment
        env["PATH"] = toolPath
        process.environment = env
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        process.terminationHandler = { [weak self] finished in
            let status = finished.terminationStatus
            Task { @MainActor in
                guard let self else { return }
                self.refresh()
                if status != 0 && !["done", "error"].contains(self.vmPhase) {
                    self.vmState = ["phase": "error", "message": "testq vm restart skončil s kódem \(status)"]
                }
            }
        }
        do {
            try process.run()
            vmTargetEdited = false
            vmState = ["phase": "inventory", "updated_at": now, "memory_gb": vmTarget]
        } catch {
            vmState = ["phase": "error", "message": "Nelze spustit \(testqPath): \(error.localizedDescription)"]
        }
    }

    private func readStats() {
        var info = host_cpu_load_info()
        var count = mach_msg_type_number_t(MemoryLayout<host_cpu_load_info>.stride / MemoryLayout<integer_t>.stride)
        let kr = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
                host_statistics(mach_host_self(), HOST_CPU_LOAD_INFO, $0, &count)
            }
        }
        if kr == KERN_SUCCESS {
            let t = info.cpu_ticks
            let busy = UInt64(t.0) + UInt64(t.1) + UInt64(t.3)
            let total = busy + UInt64(t.2)
            if let prev = prevTicks, total > prev.total {
                cpu = Double(busy - prev.busy) / Double(total - prev.total)
            }
            prevTicks = (busy, total)
        }
        var level: Int32 = 0
        var size = MemoryLayout<Int32>.size
        if sysctlbyname("kern.memorystatus_level", &level, &size, nil, 0) == 0 {
            memUsed = 1 - Double(level) / 100
        }
        var swap = xsw_usage()
        size = MemoryLayout<xsw_usage>.size
        if sysctlbyname("vm.swapusage", &swap, &size, nil, 0) == 0 {
            swapUsed = Double(swap.xsu_used)
            swapTotal = Double(swap.xsu_total)
        }
        var loads = [Double](repeating: 0, count: 3)
        if getloadavg(&loads, 3) > 0 { load = loads[0] }
    }

    private func readConfig() {
        var merged = defaultConfig
        if let data = FileManager.default.contents(atPath: configPath),
           let user = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            for (key, value) in user {
                if let dict = value as? [String: Any], var base = merged[key] as? [String: Any] {
                    base.merge(dict) { _, new in new }
                    merged[key] = base
                } else {
                    merged[key] = value
                }
            }
        }
        config = merged
    }

    private func readJobs() {
        let files = (try? FileManager.default.contentsOfDirectory(atPath: jobsDir)) ?? []
        let decoder = JSONDecoder()
        jobs = files.filter { $0.hasSuffix(".json") }
            .compactMap { FileManager.default.contents(atPath: jobsDir + "/" + $0) }
            .compactMap { try? decoder.decode(Job.self, from: $0) }
            .filter { pidAlive($0.pid) || ($0.state == "running" && pidAlive($0.childPid)) }
            .sorted { ($0.queuedAt, $0.id) < ($1.queuedAt, $1.id) }
    }

    private func readHistory() {
        guard let handle = FileHandle(forReadingAtPath: historyPath) else { return history = [] }
        defer { try? handle.close() }
        let end = handle.seekToEndOfFile()
        handle.seek(toFileOffset: end > 16_384 ? end - 16_384 : 0)
        let text = String(decoding: handle.readDataToEndOfFile(), as: UTF8.self)
        let decoder = JSONDecoder()
        history = text.split(separator: "\n").suffix(6).reversed()
            .compactMap { try? decoder.decode(HistoryEntry.self, from: Data($0.utf8)) }
    }

    func setConfig(_ path: String, _ value: Any) {
        withMutex {
            var raw = (FileManager.default.contents(atPath: configPath)
                .flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }) ?? [:]
            let parts = path.split(separator: ".").map(String.init)
            if parts.count == 2 {
                var node = raw[parts[0]] as? [String: Any] ?? [:]
                node[parts[1]] = value
                raw[parts[0]] = node
            } else {
                raw[path] = value
            }
            if let data = try? JSONSerialization.data(withJSONObject: raw, options: [.prettyPrinted, .sortedKeys]) {
                try? data.write(to: URL(fileURLWithPath: configPath), options: .atomic)
            }
        }
        refresh()
    }

    func stop(_ job: Job) {
        // testq forwards SIGTERM to the whole command tree; if it is gone, hit the command itself
        if pidAlive(job.pid) {
            kill(job.pid, SIGTERM)
        } else if let child = job.childPid, pidAlive(child) {
            kill(child, SIGTERM)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) { [weak self] in self?.refresh() }
    }
}

func healthColor(_ fraction: Double) -> Color {
    fraction < 0.6 ? .green : fraction < 0.85 ? .orange : .red
}

struct Ring: View {
    let title: String
    let fraction: Double
    let text: String
    let color: Color

    var body: some View {
        VStack(spacing: 6) {
            ZStack {
                Circle().stroke(Color.secondary.opacity(0.18), lineWidth: 5)
                Circle()
                    .trim(from: 0, to: min(max(fraction, 0), 1))
                    .stroke(color, style: StrokeStyle(lineWidth: 5, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .animation(.easeOut(duration: 0.4), value: fraction)
                Text(text).font(.system(size: 13, weight: .semibold).monospacedDigit())
            }
            .frame(width: 62, height: 62)
            Text(title).font(.caption).foregroundStyle(.secondary)
        }
    }
}

struct ClassBadge: View {
    let jobClass: String

    var body: some View {
        let (letter, color): (String, Color) = switch jobClass {
        case "heavy": ("T", .red)
        case "medium": ("S", .orange)
        default: ("L", .gray)
        }
        Text(letter)
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(.white)
            .frame(width: 18, height: 18)
            .background(Circle().fill(color))
            .help(["heavy": "těžká (E2E, mutace)", "medium": "střední (sada testů, build)"][jobClass] ?? "lehká")
    }
}

struct JobRow: View {
    @EnvironmentObject var model: Model
    let job: Job
    let position: Int?

    var body: some View {
        HStack(spacing: 8) {
            ClassBadge(jobClass: job.jobClass)
            VStack(alignment: .leading, spacing: 1) {
                Text(job.project ?? "?").font(.callout.weight(.medium)).lineLimit(1)
                Text(job.label ?? "").font(.caption).foregroundStyle(.secondary)
                    .lineLimit(1).truncationMode(.middle)
            }
            Spacer(minLength: 6)
            if let position { Text("#\(position)").font(.caption).foregroundStyle(.secondary) }
            VStack(alignment: .trailing, spacing: 1) {
                Text(fmtDuration(model.now - (job.startedAt ?? job.queuedAt)))
                    .font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                if let estimate = model.estimate(job) {
                    Text(etaText(estimate))
                        .font(.caption2.monospacedDigit()).foregroundStyle(.tertiary)
                        .help(basisText(estimate))
                }
            }
            Button { model.stop(job) } label: {
                Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
            .help(job.state == "running" ? "Ukončit běžící testy" : "Zrušit čekající běh")
        }
    }

    private func etaText(_ estimate: Estimate) -> String {
        if job.state == "running" {
            guard let end = estimate.end else { return "" }
            let elapsed = model.now - (job.startedAt ?? model.now)
            return elapsed > estimate.run ? "přes odhad \(fmtDuration(estimate.run))" : "zbývá ~\(fmtDuration(end - model.now))"
        }
        guard let start = estimate.start else { return "start ?" }
        let run = "běh ~\(fmtDuration(estimate.run))"
        return start - model.now < 5 ? "start teď · \(run)" : "start ~\(fmtDuration(start - model.now)) · \(run)"
    }

    private func basisText(_ estimate: Estimate) -> String {
        switch estimate.basis {
        case "label": "Odhad z posledních běhů stejného příkazu"
        case "project": "Odhad z běhů téže třídy v tomto projektu"
        case "class": "Odhad z běhů téže třídy ve všech projektech"
        default: "Výchozí odhad, historie zatím nic podobného nemá"
        }
    }
}

struct LimitStepper: View {
    @EnvironmentObject var model: Model
    let title: String
    let key: String
    let range: ClosedRange<Int>
    var step = 1
    var suffix = ""

    var body: some View {
        let value = model.intValue(key)
        HStack {
            Text(title).font(.callout)
            Spacer()
            Text("\(value)\(suffix)").font(.callout.monospacedDigit()).frame(minWidth: 34, alignment: .trailing)
            Stepper("", value: Binding(get: { value }, set: { model.setConfig(key, $0) }), in: range, step: step)
                .labelsHidden()
        }
    }
}

struct VMSection: View {
    @EnvironmentObject var model: Model

    var body: some View {
        if let current = model.vmMemory {
            Divider()
            Text("Docker VM (Colima)").font(.caption).foregroundStyle(.secondary)
            HStack {
                Text("Paměť VM").font(.callout)
                Spacer()
                Text(model.vmTarget == current ? "\(current) GB" : "\(current) → \(model.vmTarget) GB")
                    .font(.callout.monospacedDigit())
                    .foregroundStyle(model.vmTarget == current ? Color.primary : Color.orange)
                Stepper("", value: Binding(get: { model.vmTarget }, set: { model.setVMTarget($0) }),
                        in: 2...max(2, model.ramGB - 2))
                    .labelsHidden()
                    .disabled(model.vmBusy)
            }
            HStack(spacing: 6) {
                if model.vmBusy {
                    ProgressView().controlSize(.small)
                    Text(phaseText).font(.caption).foregroundStyle(.secondary)
                } else {
                    Text(lastResult).font(.caption)
                        .foregroundStyle(model.vmPhase == "error" ? Color.red : Color.secondary)
                        .lineLimit(2)
                    Spacer()
                    Button(model.vmTarget == current ? "Restartovat" : "Restartovat s \(model.vmTarget) GB") {
                        model.restartVM()
                    }
                    .controlSize(.small)
                }
            }
        }
    }

    private var memory: Int { (model.vmState["memory_gb"] as? NSNumber)?.intValue ?? model.vmTarget }

    private var phaseText: String {
        switch model.vmPhase {
        case "inventory": "Zjišťuji běžící kontejnery…"
        case "stopping": "Zastavuji Colimu…"
        case "starting": "Startuji Colimu s \(memory) GB…"
        default: "Spouštím kontejnery…"
        }
    }

    private var lastResult: String {
        switch model.vmPhase {
        case "done":
            let containers = (model.vmState["containers"] as? NSNumber)?.intValue ?? 0
            return "Naposledy: \(memory) GB, znovu spuštěno \(containers) kontejnerů"
        case "error":
            return "Chyba: \(model.vmState["message"] as? String ?? "neznámá")"
        default:
            return "Restart zastaví kontejnery asi na minutu"
        }
    }
}

struct ContentView: View {
    @EnvironmentObject var model: Model

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Fronta testů").font(.headline)
                Spacer()
                Text(!model.enabled ? "Vypnuto" : model.paused ? "Pozastaveno" : "Aktivní")
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(Capsule().fill((!model.enabled ? Color.gray : model.paused ? .orange : .green).opacity(0.25)))
            }

            HStack(spacing: 0) {
                Ring(title: "CPU", fraction: model.cpu, text: "\(Int(model.cpu * 100))%", color: healthColor(model.cpu))
                Spacer()
                Ring(title: "Paměť", fraction: model.memUsed, text: "\(Int(model.memUsed * 100))%", color: healthColor(model.memUsed))
                Spacer()
                Ring(title: "Swap", fraction: model.swapFraction,
                     text: String(format: "%.1fG", model.swapUsed / 1_073_741_824), color: healthColor(model.swapFraction))
                Spacer()
                let loadPerCore = model.load / Double(model.ncpu)
                Ring(title: "Load", fraction: loadPerCore / 8, text: String(format: "%.0f", model.load),
                     color: loadPerCore <= 1.5 ? .green : loadPerCore <= 4 ? .orange : .red)
            }

            Divider()

            section("Běží", model.running, numbered: false)
            section("Čeká", model.waiting, numbered: true)

            Divider()

            HStack {
                Button(model.paused ? "Pokračovat" : "Pozastavit") { model.setConfig("paused", !model.paused) }
                    .disabled(!model.enabled)
                Spacer()
                Toggle("Fronta zapnutá", isOn: Binding(get: { model.enabled }, set: { model.setConfig("enabled", $0) }))
                    .toggleStyle(.switch).controlSize(.small)
            }
            VStack(spacing: 4) {
                LimitStepper(title: "Těžké najednou (E2E, mutace)", key: "max.heavy", range: 0...4)
                LimitStepper(title: "Střední najednou (sady, buildy)", key: "max.medium", range: 1...6)
                LimitStepper(title: "Rozpočet (T=5, S=3)", key: "budget", range: 3...20)
                LimitStepper(title: "Min. volná paměť", key: "mem_min_level", range: 0...50, step: 5, suffix: " %")
                LimitStepper(title: "Workerů na jeden běh", key: "workers", range: 1...8)
            }

            VMSection()

            if !model.history.isEmpty {
                Divider()
                Text("Naposledy dokončené").font(.caption).foregroundStyle(.secondary)
                ForEach(model.history) { entry in
                    HStack(spacing: 6) {
                        Image(systemName: entry.exit == 0 ? "checkmark.circle.fill" : "xmark.octagon.fill")
                            .foregroundStyle(entry.exit == 0 ? .green : .red)
                        Text(entry.project ?? "?").font(.caption.weight(.medium))
                        Text(entry.label ?? "").font(.caption).foregroundStyle(.secondary)
                            .lineLimit(1).truncationMode(.middle)
                        Spacer(minLength: 4)
                        let start = entry.startedAt ?? entry.queuedAt
                        Text("čekal \(fmtDuration(start - entry.queuedAt)) · běžel \(fmtDuration(entry.endedAt - start))")
                            .font(.caption2.monospacedDigit()).foregroundStyle(.secondary)
                    }
                }
            }

            Divider()
            HStack {
                Button("Otevřít data") { NSWorkspace.shared.open(URL(fileURLWithPath: stateDir)) }
                Spacer()
                Button("Ukončit widget") { NSApp.terminate(nil) }
            }
            .buttonStyle(.link).font(.caption)
        }
        .padding(16)
        .frame(width: 400)
    }

    @ViewBuilder
    private func section(_ title: String, _ jobs: [Job], numbered: Bool) -> some View {
        HStack {
            Text("\(title) (\(jobs.count))")
            Spacer()
            if numbered, !jobs.isEmpty, let end = model.forecast?.queueEnd {
                Text("vše doběhne za ~\(fmtDuration(end - model.now))").monospacedDigit()
                    .help("Odhad z typických časů běhu v historii; nepočítá s čekáním na volnou paměť.")
            }
        }
        .font(.caption).foregroundStyle(.secondary)
        if jobs.isEmpty {
            Text(numbered ? "Nic nečeká" : "Nic neběží").font(.callout).foregroundStyle(.tertiary)
        } else {
            ForEach(Array(jobs.enumerated()), id: \.element.id) { index, job in
                JobRow(job: job, position: numbered ? index + 1 : nil)
            }
        }
    }
}

struct MenuLabel: View {
    @EnvironmentObject var model: Model

    var body: some View {
        let icon = !model.enabled ? "testtube.2" : model.paused ? "pause.circle"
            : model.stressed ? "exclamationmark.triangle.fill" : "testtube.2"
        HStack(spacing: 3) {
            Image(systemName: icon)
            if !model.jobs.isEmpty {
                Text("\(model.running.count)·\(model.waiting.count)").monospacedDigit()
            }
        }
    }
}

@main
struct TestQApp: App {
    @StateObject private var model = Model()

    var body: some Scene {
        MenuBarExtra {
            ContentView().environmentObject(model)
        } label: {
            MenuLabel().environmentObject(model)
        }
        .menuBarExtraStyle(.window)
    }
}
