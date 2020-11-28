package sample

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe

class MainTest : StringSpec({
    "greeting" {
        greeting("Graeme") shouldBe "Hello Graeme"
    }
})