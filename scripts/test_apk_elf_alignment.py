import struct
import unittest
from apk_elf_alignment import inspect_elf64


def elf(alignment=16384, relro_end=16384):
    data = bytearray(176)
    data[:6] = b'\x7fELF\x02\x01'
    struct.pack_into('<Q', data, 32, 64)
    struct.pack_into('<HH', data, 54, 56, 2)
    struct.pack_into('<I', data, 64, 1)
    struct.pack_into('<Q', data, 64 + 48, alignment)
    struct.pack_into('<I', data, 120, 0x6474e552)
    struct.pack_into('<Q', data, 120 + 40, relro_end)
    return data


class AlignmentTests(unittest.TestCase):
    def test_16kb_and_larger_load_alignment_pass(self):
        for alignment in (16384, 65536):
            self.assertEqual(inspect_elf64(elf(alignment))['loadAlignment'], [alignment])

    def test_4kb_load_alignment_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'LOAD alignment'):
            inspect_elf64(elf(4096))

    def test_16kb_load_with_4kb_relro_end_is_rejected(self):
        # Reproduces the actual DataStore 1.1.7 APK failure.
        with self.assertRaisesRegex(ValueError, 'RELRO end'):
            inspect_elf64(elf(relro_end=4096))

    def test_absent_relro_is_allowed(self):
        data = elf()
        struct.pack_into('<I', data, 120, 0)
        self.assertEqual(inspect_elf64(data)['relroEnds'], [])

    def test_missing_load_segments_fail_closed(self):
        data = elf()
        struct.pack_into('<I', data, 64, 0)
        with self.assertRaisesRegex(ValueError, 'LOAD alignment'):
            inspect_elf64(data)

    def test_malformed_program_headers_fail_closed(self):
        for data in (b'not an ELF', elf()[:80]):
            with self.assertRaises(ValueError):
                inspect_elf64(data)


if __name__ == '__main__':
    unittest.main(verbosity=2)
