import unittest
import urllib.request

from lobster_cli_heist.observer import ObserverServer


class ObserverTests(unittest.TestCase):
    def test_observer_serves_html_and_releases_port(self):
        server = ObserverServer(port_start=8450)
        server.start("<html><body>heist observer</body></html>")
        try:
            body = urllib.request.urlopen(server.url, timeout=3).read().decode("utf-8")
            self.assertIn("heist observer", body)
            port = server.port
        finally:
            server.stop()
        successor = ObserverServer(port_start=port, port_limit=1)
        try:
            successor.start("<html><body>reused</body></html>")
            self.assertEqual(successor.port, port)
        finally:
            successor.stop()


if __name__ == "__main__":
    unittest.main()
