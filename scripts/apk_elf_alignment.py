"""Check 64-bit APK libraries against Android's 16 KB LOAD/RELRO rules."""
import struct
import zipfile


def inspect_elf64(data, name='library'):
    if len(data) < 64 or data[:5] != b'\x7fELF\x02' or data[5] not in (1, 2):
        raise ValueError('Invalid 64-bit ELF: ' + name)
    endian = '<' if data[5] == 1 else '>'
    unpack = lambda kind, offset: struct.unpack_from(endian + kind, data, offset)[0]
    phoff, phsize, phnum = unpack('Q', 32), unpack('H', 54), unpack('H', 56)
    if phsize < 56 or phoff + phsize * phnum > len(data):
        raise ValueError('Invalid ELF program headers: ' + name)
    loads, relro = [], []
    for index in range(phnum):
        offset = phoff + index * phsize
        kind = unpack('I', offset)
        if kind == 1:
            loads.append(unpack('Q', offset + 48))
        if kind == 0x6474e552:
            relro.append(unpack('Q', offset + 16) + unpack('Q', offset + 40))
    if not loads or any(alignment < 16384 for alignment in loads):
        raise ValueError('ELF LOAD alignment below 16 KB: ' + name)
    if any(end % 16384 != 0 for end in relro):
        raise ValueError('ELF RELRO end is not aligned to 16 KB: ' + name)
    return {'library': name, 'loadAlignment': loads, 'relroEnds': relro}


def verify_apk_elf_alignment(apk_path):
    with zipfile.ZipFile(apk_path) as apk:
        return [inspect_elf64(apk.read(name), name) for name in apk.namelist()
                if name.startswith(('lib/arm64-v8a/', 'lib/x86_64/')) and name.endswith('.so')]
